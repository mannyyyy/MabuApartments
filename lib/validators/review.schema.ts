import * as z from "zod"

export const reviewListQuerySchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
})

export const createReviewInputSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().min(1),
})

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>

