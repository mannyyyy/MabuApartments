import { unavailableDatesQuerySchema } from "@/lib/validators/availability.schema"
import { getUnavailableDatesAction } from "@/app/actions/availability"
import { fail, ok } from "@/lib/api/response"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const parsedQuery = unavailableDatesQuerySchema.safeParse({
    roomTypeId: searchParams.get("roomTypeId") ?? "",
  })

  if (!parsedQuery.success) {
    return fail("Room Type ID is required", 400, "VALIDATION_ERROR", parsedQuery.error.flatten())
  }

  try {
    const result = await getUnavailableDatesAction(parsedQuery.data)
    return ok(result)
  } catch (error) {
    console.error("Error fetching unavailable dates:", error)
    return fail("Failed to fetch unavailable dates")
  }
}
