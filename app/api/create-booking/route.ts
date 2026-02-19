import { NextResponse } from "next/server"
import { createBookingAction } from "@/app/actions/bookings"

export async function POST(req: Request) {
  try {
    const result = await createBookingAction(await req.json())
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json({ success: false, error: "Failed to create booking" }, { status: 500 })
  }
}
