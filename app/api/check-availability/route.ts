import { NextResponse } from "next/server"
import { checkAvailabilityAction } from "@/app/actions/availability"

export async function POST(req: Request) {
  try {
    const result = await checkAvailabilityAction(await req.json())
    return NextResponse.json(result)
  } catch (error) {
    console.error("Error checking availability:", error)
    return NextResponse.json({ error: "Failed to check availability" }, { status: 500 })
  }
}
