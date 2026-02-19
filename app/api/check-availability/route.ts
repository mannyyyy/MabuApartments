import { NextResponse } from "next/server"
import { checkAvailabilitySchema } from "@/lib/validators/availability.schema"
import { findAvailableRoom } from "@/services/availability.service"

export async function POST(req: Request) {
  try {
    const input = checkAvailabilitySchema.parse(await req.json())
    const room = await findAvailableRoom(input)

    if (room) {
      return NextResponse.json({
        available: true,
        roomId: room.id,
      })
    }

    return NextResponse.json({ available: false })
  } catch (error) {
    console.error("Error checking availability:", error)
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 })
  }
}
