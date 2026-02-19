import { NextResponse } from "next/server"
import { z } from "zod"
import { initializePaystackTransaction } from "@/lib/payments/paystack"

const createPaymentSchema = z.object({
  email: z.string().trim().email(),
  amount: z.number().int().positive(),
  metadata: z.record(z.string(), z.unknown()).default({}),
})

export async function POST(req: Request): Promise<Response> {
  try {
    const body = await req.json()
    const parsed = createPaymentSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid payment initialization payload", errors: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const payment = await initializePaystackTransaction({
      email: parsed.data.email,
      amount: parsed.data.amount,
      metadata: parsed.data.metadata,
    })

    return NextResponse.json(payment)
  } catch (error) {
    console.error("Unexpected error while creating payment", error)
    return NextResponse.json({ message: "Failed to initialize payment" }, { status: 500 })
  }
}
