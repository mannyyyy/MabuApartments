import { NextResponse } from 'next/server'
import { reviewListQuerySchema } from '@/lib/validators/review.schema'
import { getPaginatedReviews } from '@/services/review.service'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const roomId = searchParams.get('roomId')
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '5')

  const roomIdValidation = reviewListQuerySchema.safeParse({ roomId: roomId ?? '' })
  if (!roomIdValidation.success) {
    return NextResponse.json({ error: 'Room ID is required' }, { status: 400 })
  }

  try {
    const { reviews, hasMore } = await getPaginatedReviews({
      roomId: roomIdValidation.data.roomId,
      page,
      limit,
    })

    return NextResponse.json({
      reviews,
      hasMore,
    })
  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json({ error: 'Failed to fetch reviews' }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error: "Review creation moved to server actions. Use submitReviewAction.",
    },
    { status: 405 },
  )
}
