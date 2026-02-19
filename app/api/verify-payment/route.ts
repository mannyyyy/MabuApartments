import { NextResponse } from "next/server"
import prisma from "@/lib/db"
import { verifyPaystackTransaction } from "@/lib/payments/paystack"

export async function GET(req: Request): Promise<Response> {
  try {
    const url = new URL(req.url)
    const reference = url.searchParams.get("reference")

    if (!reference) {
      return NextResponse.json({ status: "error", message: "Missing reference parameter" }, { status: 400 })
    }

    const data = await verifyPaystackTransaction(reference)

    const booking = await prisma.booking.findUnique({
      where: { paymentReference: reference },
      select: { id: true },
    })

    const bookingRequest = await prisma.bookingRequest.findUnique({
      where: { paymentReference: reference },
      select: {
        id: true,
        paymentStatus: true,
        bookingId: true,
      },
    })

    return NextResponse.json({
      status: "success",
      reference: data.reference,
      amount: data.amount,
      paidAt: data.paid_at,
      bookingConfirmed: Boolean(booking?.id || bookingRequest?.bookingId),
      bookingRequestStatus: bookingRequest?.paymentStatus ?? null,
    })
  } catch (error) {
    console.error("Error verifying payment", error)
    return NextResponse.json({ status: "error", message: "Error processing payment verification" }, { status: 500 })
  }
}
