import { NextResponse } from "next/server"
import crypto from "crypto"
import { Prisma } from "@prisma/client"
import { createBookingAction } from "@/app/actions/bookings"
import { findAvailableRoom } from "@/services/availability.service"
import {
  getBookingRequestByIdOrReference,
  markBookingRequestAsPaid,
} from "@/services/booking-request.service"

type ChargeSuccessPayload = {
  event: string
  data?: {
    metadata?: Record<string, unknown>
    reference?: string
  }
}

function signatureMatches(payload: string, signature: string | null) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret || !signature) {
    return false
  }

  const hash = crypto.createHmac("sha512", secret).update(payload).digest("hex")
  return hash === signature
}

function readBookingRequestId(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return null
  const value = metadata.bookingRequestId
  return typeof value === "string" && value.trim().length > 0 ? value : null
}

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = req.headers.get("x-paystack-signature")

    if (!signatureMatches(rawBody, signature)) {
      return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(rawBody) as ChargeSuccessPayload
    if (event.event !== "charge.success" || !event.data?.reference) {
      return NextResponse.json({ received: true })
    }

    const paymentReference = event.data.reference
    const bookingRequestId = readBookingRequestId(event.data.metadata)
    const bookingRequest = await getBookingRequestByIdOrReference(bookingRequestId, paymentReference)

    if (!bookingRequest) {
      console.error("No booking request found for webhook reference", paymentReference)
      return NextResponse.json({ message: "Booking request not found" }, { status: 404 })
    }

    if (bookingRequest.paymentStatus === "paid" && bookingRequest.bookingId) {
      return NextResponse.json({ received: true, deduped: true })
    }

    const availableRoom = await findAvailableRoom({
      roomTypeId: bookingRequest.roomTypeId,
      checkIn: bookingRequest.arrivalDate.toISOString(),
      checkOut: bookingRequest.departureDate.toISOString(),
    })

    if (!availableRoom) {
      return NextResponse.json({ message: "Room no longer available" }, { status: 409 })
    }

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
      return NextResponse.json({ message: "Unable to create booking" }, { status: 500 })
    }

    await markBookingRequestAsPaid({
      bookingRequestId: bookingRequest.id,
      paymentReference,
      bookingId: bookingResult.booking.id,
    })

    return NextResponse.json({ received: true, bookingId: bookingResult.booking.id })
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ received: true, deduped: true })
    }

    console.error("Error processing webhook:", error)
    return NextResponse.json({ message: "Webhook error" }, { status: 500 })
  }
}
