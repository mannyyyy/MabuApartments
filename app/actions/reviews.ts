"use server"

import { createReviewInputSchema } from "@/lib/validators/review.schema"
import { createReview } from "@/services/review.service"
import { sanitizeText } from "@/lib/security/sanitize"

export async function submitReviewAction(input: unknown) {
  const rawInput = (input ?? {}) as Record<string, unknown>
  const parsedPayload = createReviewInputSchema.parse({
    ...rawInput,
    name: sanitizeText(String(rawInput.name ?? ""), 80),
    comment: sanitizeText(String(rawInput.comment ?? ""), 2000),
  })
  return createReview(parsedPayload)
}
