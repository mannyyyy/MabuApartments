"use server"

import { createReviewInputSchema } from "@/lib/validators/review.schema"
import { createReview } from "@/services/review.service"

export async function submitReviewAction(input: unknown) {
  const parsedPayload = createReviewInputSchema.parse(input)
  return createReview(parsedPayload)
}
