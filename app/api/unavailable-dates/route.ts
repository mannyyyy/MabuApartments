import { NextResponse } from "next/server"
import { ZodError } from "zod"
import { getUnavailableDatesAction } from "@/app/actions/availability"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const roomTypeId = searchParams.get("roomTypeId")

  try {
    const result = await getUnavailableDatesAction({ roomTypeId })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Room Type ID is required" }, { status: 400 })
    }
    console.error("Error fetching unavailable dates:", error)
    return NextResponse.json({ error: "Failed to fetch unavailable dates" }, { status: 500 })
  }
}
