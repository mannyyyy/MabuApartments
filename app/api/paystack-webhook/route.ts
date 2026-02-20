import { NextResponse } from "next/server"
import crypto from "crypto"
import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import { createBookingAction } from "@/app/actions/bookings"
import { verifyPaystackTransaction } from "@/lib/payments/paystack"
import { findAvailableRoom } from "@/services/availability.service"
import {
  getBookingRequestByIdOrReference,
  markBookingRequestAsPaid,
  markBookingRequestAsPaidNeedsReview,
} from "@/services/booking-request.service"

type ChargeSuccessPayload = {
  event: string
  data?: {
    metadata?: Record<string, unknown>
    reference?: string
  }
}

const EXPECTED_CURRENCY = "NGN"

function signatureMatches(payload: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) {
    return false
  }

  const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex")
  const expectedBuffer = Buffer.from(hash)
  const providedBuffer = Buffer.from(signature.trim())
  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }
  return crypto.timingSafeEqual(expectedBuffer, providedBuffer)
}

function readBookingRequestId(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null
  const value = metadata.bookingRequestId
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

function normalizeCurrency(value: string | null | undefined) {
  return value?.trim().toUpperCase() ?? null
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }
  return "Unknown error"
}

export async function POST(req: Request) {
  try {
    const requestUrl = new URL(req.url)
    const environment = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown"
    const rawBody = await req.text()
    const signature = req.headers.get("x-paystack-signature")

    if (!signatureMatches(rawBody, signature)) {
      console.warn("Rejected Paystack webhook due to invalid signature", {
        host: requestUrl.host,
        environment,
        hasSignature: Boolean(signature),
      })
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
    }

    let event: ChargeSuccessPayload
    try {
      event = JSON.parse(rawBody) as ChargeSuccessPayload
    } catch {
      return NextResponse.json({ message: "Invalid JSON payload" }, { status: 400 })
    }

    const reference = event.data?.reference?.trim() ?? null
    const bookingRequestId = readBookingRequestId(event.data?.metadata)
    console.info("Received Paystack webhook event", {
      host: requestUrl.host,
      environment,
      event: event.event,
      reference,
      bookingRequestId,
    })

    if (event.event !== "charge.success" || !reference) {
      return NextResponse.json({ received: true })
    }

    const paymentReference = reference
    const bookingRequest = await getBookingRequestByIdOrReference(bookingRequestId, paymentReference)

    if (!bookingRequest) {
      console.error("No booking request found for webhook reference", paymentReference)
      return NextResponse.json({ received: true, orphanedReference: paymentReference })
    }

    if (bookingRequest.paymentStatus === "paid" && bookingRequest.bookingId) {
      return NextResponse.json({ received: true, deduped: true, bookingId: bookingRequest.bookingId })
    }

    if (bookingRequest.paymentStatus === "paid_needs_review") {
      return NextResponse.json({ received: true, deduped: true, requiresReview: true })
    }

    if (bookingRequest.paymentReference && bookingRequest.paymentReference !== paymentReference) {
      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "REFERENCE_MISMATCH_WITH_REQUEST",
        lastError: `Request reference ${bookingRequest.paymentReference} did not match webhook reference ${paymentReference}.`,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }

    const verifiedPayment = await verifyPaystackTransaction(paymentReference)
    const verifiedCurrency = normalizeCurrency(verifiedPayment.currency)
    const verifiedAmountKobo = verifiedPayment.amount
    const paystackStatus = verifiedPayment.status.trim().toLowerCase()

    if (verifiedPayment.reference !== paymentReference) {
      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "REFERENCE_MISMATCH_WITH_VERIFICATION",
        lastError: `Verification reference ${verifiedPayment.reference} did not match webhook reference ${paymentReference}.`,
        verifiedAmountKobo,
        verifiedCurrency,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }

    if (paystackStatus !== "success") {
      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "PAYMENT_STATUS_NOT_SUCCESS",
        lastError: `Paystack verification returned status "${paystackStatus}".`,
        verifiedAmountKobo,
        verifiedCurrency,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }

    if (verifiedAmountKobo !== bookingRequest.amountKobo || verifiedCurrency !== EXPECTED_CURRENCY) {
      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "AMOUNT_OR_CURRENCY_MISMATCH",
        lastError: `Expected ${bookingRequest.amountKobo} ${EXPECTED_CURRENCY}, got ${verifiedAmountKobo} ${verifiedCurrency ?? "unknown"}.`,
        verifiedAmountKobo,
        verifiedCurrency,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }

    const availableRoom = await findAvailableRoom({
      roomTypeId: bookingRequest.roomTypeId,
      checkIn: bookingRequest.arrivalDate.toISOString(),
      checkOut: bookingRequest.departureDate.toISOString(),
    })

    if (!availableRoom) {
      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "PAID_BUT_NO_ROOM_AVAILABLE",
        lastError: "Payment is verified but no room is available for the selected dates.",
        verifiedAmountKobo,
        verifiedCurrency,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }

    try {
      const bookingResult = await createBookingAction({
        roomId: availableRoom.id,
        guestName: bookingRequest.fullName,
        guestEmail: bookingRequest.email,
        checkIn: bookingRequest.arrivalDate.toISOString(),
        checkOut: bookingRequest.departureDate.toISOString(),
        totalPrice: bookingRequest.amountKobo / 100,
        paymentReference,
      })

      if (!bookingResult.success || !bookingResult.booking) {
        await markBookingRequestAsPaidNeedsReview({
          bookingRequestId: bookingRequest.id,
          paymentReference,
          reviewReason: "BOOKING_CREATION_RETURNED_UNSUCCESSFUL",
          lastError: "Booking creation returned an unsuccessful response.",
          verifiedAmountKobo,
          verifiedCurrency,
        })
        return NextResponse.json({ received: true, requiresReview: true })
      }

      await markBookingRequestAsPaid({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        bookingId: bookingResult.booking.id,
        verifiedAmountKobo,
        verifiedCurrency,
      })

      return NextResponse.json({ received: true, bookingId: bookingResult.booking.id })
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const existingBooking = await prisma.booking.findUnique({
          where: { paymentReference },
          select: { id: true },
        })

        if (existingBooking?.id) {
          await markBookingRequestAsPaid({
            bookingRequestId: bookingRequest.id,
            paymentReference,
            bookingId: existingBooking.id,
            verifiedAmountKobo,
            verifiedCurrency,
          })
          return NextResponse.json({ received: true, deduped: true, bookingId: existingBooking.id })
        }
      }

      await markBookingRequestAsPaidNeedsReview({
        bookingRequestId: bookingRequest.id,
        paymentReference,
        reviewReason: "BOOKING_CREATION_EXCEPTION",
        lastError: errorMessage(error),
        verifiedAmountKobo,
        verifiedCurrency,
      })
      return NextResponse.json({ received: true, requiresReview: true })
    }
  } catch (error) {
    console.error("Error processing webhook:", error)
    return NextResponse.json({ message: "Webhook error" }, { status: 500 })
  }
}
