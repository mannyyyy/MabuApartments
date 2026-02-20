import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { verifyPaystackTransaction } from "@/lib/payments/paystack"

type VerificationState = "confirmed" | "processing" | "needs_review" | "failed" | "unknown"

function deriveVerificationState(input: {
  hasBooking: boolean
  bookingRequestStatus: string | null
  bookingRequestHasBooking: boolean
}): VerificationState {
  if (input.hasBooking || input.bookingRequestHasBooking) {
    return "confirmed"
  }

  const status = input.bookingRequestStatus?.trim().toLowerCase() ?? null
  if (!status) {
    return "unknown"
  }

  if (status === "paid_needs_review") {
    return "needs_review"
  }

  if (status === "failed" || status === "expired") {
    return "failed"
  }

  if (status === "initiated" || status === "paid") {
    return "processing"
  }

  return "unknown"
}

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get("reference")

    if (!reference) {
      return NextResponse.json({ status: "error", message: "Missing reference parameter" }, { status: 400 })
    }

    const [booking, bookingRequest] = await Promise.all([
      prisma.booking.findUnique({
        where: { paymentReference: reference },
        select: { id: true },
      }),
      prisma.bookingRequest.findUnique({
        where: { paymentReference: reference },
        select: {
          id: true,
          paymentStatus: true,
          bookingId: true,
          reviewReason: true,
        },
      }),
    ])

    const verificationState = deriveVerificationState({
      hasBooking: Boolean(booking?.id),
      bookingRequestStatus: bookingRequest?.paymentStatus ?? null,
      bookingRequestHasBooking: Boolean(bookingRequest?.bookingId),
    })

    let paystackData: Awaited<ReturnType<typeof verifyPaystackTransaction>> | null = null
    try {
      paystackData = await verifyPaystackTransaction(reference)
    } catch (error) {
      console.error("Paystack verify failed during status polling", error)
    }

    return NextResponse.json({
      status: "success",
      reference: paystackData?.reference ?? reference,
      amount: paystackData?.amount ?? null,
      paidAt: paystackData?.paid_at ?? null,
      paystackTransactionStatus: paystackData?.status ?? null,
      paystackVerified: Boolean(paystackData),
      bookingConfirmed: verificationState === "confirmed",
      verificationState,
      bookingRequestStatus: bookingRequest?.paymentStatus ?? null,
      reviewReason: bookingRequest?.reviewReason ?? null,
    })
  } catch (error) {
    console.error("Error verifying payment", error)
    return NextResponse.json({ status: "error", message: "Error processing payment verification" }, { status: 500 })
  }
}
