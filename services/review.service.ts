import prisma from "@/lib/db"
import type { CreateReviewInput } from "@/lib/validators/review.schema"

type GetReviewsInput = {
  roomId: string
  page: number
  limit: number
}

export async function getPaginatedReviews({ roomId, page, limit }: GetReviewsInput) {
  const reviews = await prisma.review.findMany({
    where: { roomId },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit + 1,
    distinct: ["id"],
  })

  const hasMore = reviews.length > limit
  return {
    reviews: hasMore ? reviews.slice(0, -1) : reviews,
    hasMore,
  }
}

export async function createReview(input: CreateReviewInput) {
  return prisma.review.create({
    data: input,
  })
}

