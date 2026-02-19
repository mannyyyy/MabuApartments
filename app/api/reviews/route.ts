import { NextResponse } from 'next/server'
import { createReviewInputSchema, reviewListQuerySchema } from '@/lib/validators/review.schema'
import { createReview, getPaginatedReviews } from '@/services/review.service'

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

export async function POST(req: Request) {
  try {
    const payload = await req.json()
    const parsedPayload = createReviewInputSchema.safeParse(payload)
    if (!parsedPayload.success) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const newReview = await createReview(parsedPayload.data)

    return NextResponse.json(newReview)
  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}
