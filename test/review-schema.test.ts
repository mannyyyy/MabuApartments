import test from "node:test"
import assert from "node:assert/strict"
import { createReviewInputSchema, reviewListQuerySchema } from "../lib/validators/review.schema"

test("reviewListQuerySchema parses valid query and enforces limits", () => {
  const valid = reviewListQuerySchema.safeParse({
    roomId: "room_123",
    page: "2",
    limit: "5",
  })

  assert.equal(valid.success, true)
  if (valid.success) {
    assert.equal(valid.data.page, 2)
    assert.equal(valid.data.limit, 5)
  }

  const invalid = reviewListQuerySchema.safeParse({
    roomId: "room_123",
    page: "0",
    limit: "50",
  })

  assert.equal(invalid.success, false)
})

test("createReviewInputSchema enforces bounds for name, rating, and comment", () => {
  const valid = createReviewInputSchema.safeParse({
    roomId: "room_123",
    name: "Guest",
    rating: 5,
    comment: "Great stay.",
  })
  assert.equal(valid.success, true)

  const invalidRating = createReviewInputSchema.safeParse({
    roomId: "room_123",
    name: "Guest",
    rating: 7,
    comment: "Great stay.",
  })
  assert.equal(invalidRating.success, false)

  const invalidComment = createReviewInputSchema.safeParse({
    roomId: "room_123",
    name: "Guest",
    rating: 4,
    comment: "",
  })
  assert.equal(invalidComment.success, false)
})
