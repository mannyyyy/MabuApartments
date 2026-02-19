import { NextResponse } from "next/server"
import { unavailableDatesQuerySchema } from "@/lib/validators/availability.schema"
import { getUnavailableDatesForRoomType } from "@/services/availability.service"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const roomTypeId = searchParams.get("roomTypeId") ?? ""

  const parsedQuery = unavailableDatesQuerySchema.safeParse({ roomTypeId })
  if (!parsedQuery.success) {
    return NextResponse.json({ error: "Room Type ID is required" }, { status: 400 })
  }

  try {
    const unavailableDates = await getUnavailableDatesForRoomType(parsedQuery.data.roomTypeId)
    return NextResponse.json({
      unavailableDates,
    })
  } catch (error) {
    console.error("Error fetching unavailable dates:", error)
    return NextResponse.json({ error: "Failed to fetch unavailable dates" }, { status: 500 })
  }
}
