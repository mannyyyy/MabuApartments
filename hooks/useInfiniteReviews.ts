"use client"

import { useCallback, useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"

export type Review = {
  id: string
  name: string
  rating: number
  comment: string
  createdAt: string
}

export function useInfiniteReviews(roomId: string) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [sentinelRef, inView] = useInView()

  const fetchReviews = useCallback(
    async (pageNumber: number) => {
      try {
        setIsFetching(true)
        const response = await fetch(`/api/reviews?roomId=${roomId}&page=${pageNumber}&limit=5`)
        const data = await response.json()

        setReviews((prevReviews) => {
          const newReviews = [...prevReviews, ...data.reviews]
          const uniqueReviews = Array.from(new Set(newReviews.map((r) => r.id))).map(
            (id) => newReviews.find((r) => r.id === id)!,
          )
          return uniqueReviews
        })

        setHasMore(data.hasMore)
      } catch (error) {
        console.error("Error fetching reviews:", error)
      } finally {
        setIsFetching(false)
      }
    },
    [roomId],
  )

  useEffect(() => {
    fetchReviews(1)
  }, [fetchReviews])

  useEffect(() => {
    if (inView && hasMore && !isFetching) {
      fetchReviews(page)
      setPage((prevPage) => prevPage + 1)
    }
  }, [inView, hasMore, isFetching, page, fetchReviews])

  const reloadReviews = useCallback(() => {
    setReviews([])
    setPage(1)
    setHasMore(true)
    fetchReviews(1)
  }, [fetchReviews])

  return {
    reviews,
    hasMore,
    sentinelRef,
    isFetching,
    reloadReviews,
  }
}

