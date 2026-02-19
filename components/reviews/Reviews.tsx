"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { LeaveReviewForm } from "@/components/leave-review-form"
import { ReviewsList } from "@/components/reviews/ReviewsList"
import { useInfiniteReviews } from "@/hooks/useInfiniteReviews"

const globalStyles = `
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
`

type ReviewsProps = {
  roomId: string
}

export function Reviews({ roomId }: ReviewsProps) {
  const [showReviewForm, setShowReviewForm] = useState(false)
  const { reviews, hasMore, sentinelRef, reloadReviews } = useInfiniteReviews(roomId)

  useEffect(() => {
    if (typeof window !== "undefined") {
      const styleTag = document.createElement("style")
      styleTag.textContent = globalStyles
      document.head.appendChild(styleTag)

      return () => {
        document.head.removeChild(styleTag)
      }
    }
  }, [])

  const handleCloseReviewForm = () => {
    setShowReviewForm(false)
    reloadReviews()
  }

  return (
    <div className="pt-8 mt-20 max-w-3xl px-4 sm:px-6 lg:px-8 bg-[#faf9f6]">
      <h2 className="text-3xl font-semibold mb-6 ml-4">Guest Reviews</h2>
      <ReviewsList reviews={reviews} hasMore={hasMore} sentinelRef={sentinelRef} />
      <div className="mt-8 flex justify-center">
        <Button onClick={() => setShowReviewForm(true)} className="bg-[#978667] hover:bg-[#4B514C] text-white font-semibold">
          Leave a Review
        </Button>
      </div>
      {showReviewForm && <LeaveReviewForm onClose={handleCloseReviewForm} roomId={roomId} />}
    </div>
  )
}

