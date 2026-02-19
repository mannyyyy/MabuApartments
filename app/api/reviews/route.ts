import { reviewListQuerySchema } from '@/lib/validators/review.schema'
import { getPaginatedReviews } from '@/services/review.service'
import { fail, ok } from "@/lib/api/response"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const parsedQuery = reviewListQuerySchema.safeParse({
    roomId: searchParams.get('roomId') ?? '',
    page: searchParams.get('page') ?? '1',
    limit: searchParams.get('limit') ?? '5',
  })

  if (!parsedQuery.success) {
    return fail("Invalid review query parameters", 400, "VALIDATION_ERROR", parsedQuery.error.flatten())
  }

  try {
    const { reviews, hasMore } = await getPaginatedReviews({
      roomId: parsedQuery.data.roomId,
      page: parsedQuery.data.page,
      limit: parsedQuery.data.limit,
    })

    return ok({
      reviews,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return fail("Failed to fetch reviews")
  }
}

export async function POST() {
  return fail("Review creation moved to server actions. Use submitReviewAction.", 405, "METHOD_NOT_ALLOWED")
}
