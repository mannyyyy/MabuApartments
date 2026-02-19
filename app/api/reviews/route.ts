import { NextResponse } from 'next/server'
import { ZodError } from "zod"
import { reviewListQuerySchema } from '@/lib/validators/review.schema'
import { getPaginatedReviews } from '@/services/review.service'
import { submitReviewAction } from "@/app/actions/reviews"

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
    const newReview = await submitReviewAction(await req.json())

    return NextResponse.json(newReview)
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    console.error('Error creating review:', error)
    return NextResponse.json({ error: 'Failed to create review' }, { status: 500 })
  }
}
