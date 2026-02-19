import type { RefCallback } from "react"
import type { Review } from "@/hooks/useInfiniteReviews"
import { ReviewCard } from "@/components/reviews/ReviewCard"

type ReviewsListProps = {
  reviews: Review[]
  hasMore: boolean
  sentinelRef: RefCallback<HTMLDivElement>
}

export function ReviewsList({ reviews, hasMore, sentinelRef }: ReviewsListProps) {
  return (
    <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-4 scrollbar-hide" style={{ scrollBehavior: "smooth" }}>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
      {hasMore && <div ref={sentinelRef} className="h-10" />}
    </div>
  )
}
