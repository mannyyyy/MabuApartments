import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { bookingRequestInitiateSchema } from "@/lib/validators/booking-request.schema"
import { findAvailableRoom } from "@/services/availability.service"
import {
  createBookingRequest,
  findLatestReusableBookingRequest,
  markBookingRequestAsFailed,
  prepareBookingRequestForPaymentRetry,
  recordBookingRequestInitError,
  saveBookingRequestPaymentReference,
} from "@/services/booking-request.service"
import {
  initializePaystackTransaction,
  PaymentInitNonRetryableError,
  PaymentInitRetryableError,
  PaymentInitTimeoutError,
} from "@/lib/payments/paystack"
import { enforceRateLimit } from "@/lib/security/rate-limit-redis"
import { getRequestIp } from "@/lib/security/request-ip"
import { dayKeyToEpochDay } from "@/lib/booking-time-policy"

const INITIATE_WINDOW_MS = 10 * 60 * 1000
const INITIATE_LIMIT = 6

function getRetryAfterSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
}

function readForwardedValue(raw: string | null) {
  if (!raw) {
    return null
  }

  const firstValue = raw.split(",")[0]?.trim()
  return firstValue && firstValue.length > 0 ? firstValue : null
}

function deriveCallbackBaseUrl(req: Request) {
  const forwardedHost = readForwardedValue(req.headers.get("x-forwarded-host"))
  const forwardedProto = readForwardedValue(req.headers.get("x-forwarded-proto")) ?? "https"

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(req.url).origin
}

export async function POST(req: Request) {
  try {
    const ip = getRequestIp(req)
    const rateLimit = await enforceRateLimit({
      bucket: "booking_request_initiate",
      identifier: ip,
      limit: INITIATE_LIMIT,
      windowMs: INITIATE_WINDOW_MS,
    })

    if (rateLimit.limited) {
      return NextResponse.json(
        {
          message: "Too many booking attempts. Please try again shortly.",
          retryAfterSeconds: getRetryAfterSeconds(rateLimit.resetAt),
        },
        { status: 429 },
      )
    }

    const body = await req.json()
    const parsed = bookingRequestInitiateSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid booking request payload", errors: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const input = parsed.data
    const availableRoom = await findAvailableRoom({
      roomTypeId: input.roomTypeId,
      checkIn: input.arrivalDate,
      checkOut: input.departureDate,
    })

    if (!availableRoom) {
      return NextResponse.json(
        { message: "Selected room is no longer available for the chosen dates" },
        { status: 409 },
      )
    }

    const roomType = await prisma.roomType.findUnique({
      where: { id: input.roomTypeId },
      select: { price: true },
    })

    if (!roomType) {
      return NextResponse.json({ message: "Invalid room type selected" }, { status: 400 })
    }

    const nights = dayKeyToEpochDay(input.departureDate) - dayKeyToEpochDay(input.arrivalDate)
    const amountKobo = Math.round(roomType.price * nights * 100)

    const reusableBookingRequest = await findLatestReusableBookingRequest({
      email: input.email,
      roomTypeId: input.roomTypeId,
      arrivalDate: input.arrivalDate,
      departureDate: input.departureDate,
      amountKobo,
    })

    const bookingRequest = reusableBookingRequest
      ? await prepareBookingRequestForPaymentRetry(reusableBookingRequest.id)
      : await createBookingRequest(input, amountKobo)

    try {
      const callbackBaseUrl = deriveCallbackBaseUrl(req)
      console.info("Initializing Paystack transaction", {
        bookingRequestId: bookingRequest.id,
        callbackBaseUrl,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      })

      const payment = await initializePaystackTransaction({
        email: input.email,
        amount: amountKobo,
        metadata: {
          bookingRequestId: bookingRequest.id,
          roomTypeId: input.roomTypeId,
          roomSpecification: input.roomSpecification,
          arrivalDate: input.arrivalDate,
          departureDate: input.departureDate,
        },
      }, { callbackBaseUrl })

      await saveBookingRequestPaymentReference(bookingRequest.id, payment.reference)

      return NextResponse.json({
        bookingRequestId: bookingRequest.id,
        authorization_url: payment.authorization_url,
        access_code: payment.access_code,
        reference: payment.reference,
      })
    } catch (paymentError) {
      const reason =
        paymentError instanceof Error ? paymentError.message : "Payment initialization failed"
      if (
        paymentError instanceof PaymentInitTimeoutError ||
        paymentError instanceof PaymentInitRetryableError
      ) {
        await recordBookingRequestInitError(bookingRequest.id, reason)
        return NextResponse.json(
          {
            message: "Payment provider is temporarily unavailable. Please try again.",
            retryable: true,
            code: "PAYMENT_INIT_TEMPORARY_UNAVAILABLE",
            bookingRequestId: bookingRequest.id,
          },
          { status: 503 },
        )
      }

      await markBookingRequestAsFailed(bookingRequest.id, reason)
      if (paymentError instanceof PaymentInitNonRetryableError) {
        return NextResponse.json(
          {
            message: reason,
            retryable: false,
            code: "PAYMENT_INIT_REJECTED",
            bookingRequestId: bookingRequest.id,
          },
          { status: 502 },
        )
      }

      throw paymentError
    }
  } catch (error) {
    console.error("Failed to initiate booking request", error)
    return NextResponse.json({ message: "Failed to initiate booking request" }, { status: 500 })
  }
}
