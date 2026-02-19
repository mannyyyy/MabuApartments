import * as z from "zod"

export const reviewListQuerySchema = z.object({
  roomId: z.string().min(1, "Room ID is required"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(20).default(5),
})

export const createReviewInputSchema = z.object({
  roomId: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().min(1).max(2000),
})

export type CreateReviewInput = z.infer<typeof createReviewInputSchema>
