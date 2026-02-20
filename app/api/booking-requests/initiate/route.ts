import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { bookingRequestInitiateSchema } from "@/lib/validators/booking-request.schema"
import { findAvailableRoom } from "@/services/availability.service"
import {
  createBookingRequest,
  markBookingRequestAsFailed,
  saveBookingRequestPaymentReference,
} from "@/services/booking-request.service"
import { initializePaystackTransaction } from "@/lib/payments/paystack"
import { enforceRateLimit } from "@/lib/security/rate-limit-redis"
import { getRequestIp } from "@/lib/security/request-ip"

const INITIATE_WINDOW_MS = 10 * 60 * 1000
const INITIATE_LIMIT = 6

function getRetryAfterSeconds(resetAt: number) {
  return Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))
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

    const arrivalDate = new Date(input.arrivalDate)
    const departureDate = new Date(input.departureDate)
    const stayMs = departureDate.getTime() - arrivalDate.getTime()
    const nights = Math.max(1, Math.ceil(stayMs / (1000 * 60 * 60 * 24)))
    const amountKobo = Math.round(roomType.price * nights * 100)

    const bookingRequest = await createBookingRequest(input, amountKobo)

    try {
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
      })

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
      await markBookingRequestAsFailed(bookingRequest.id, reason)
      throw paymentError
    }
  } catch (error) {
    console.error("Failed to initiate booking request", error)
    return NextResponse.json({ message: "Failed to initiate booking request" }, { status: 500 })
  }
}
