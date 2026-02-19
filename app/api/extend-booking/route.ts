import { NextResponse } from "next/server"
import { extendBookingAction } from "@/app/actions/bookings"

export async function POST(req: Request) {
  try {
    const result = await extendBookingAction(await req.json())
    return NextResponse.json(result.body, { status: result.status })
  } catch (error) {
    console.error("Error extending booking:", error)
    return NextResponse.json({ message: "An error occurred while extending the booking" }, { status: 500 })
  }
}
