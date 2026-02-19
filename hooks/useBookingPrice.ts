"use client"

import { useMemo } from "react"
import { differenceInDays } from "date-fns"
import type { BookingDateRange } from "@/lib/validators/booking.schema"

export function useBookingPrice(price: number, dateRange: BookingDateRange) {
  const totalPrice = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      const nights = Math.max(1, differenceInDays(dateRange.to, dateRange.from))
      return price * nights
    }
    return 0
  }, [dateRange, price])

  const nights = useMemo(() => {
    if (dateRange.from && dateRange.to) {
      return differenceInDays(dateRange.to, dateRange.from)
    }
    return 0
  }, [dateRange])

  return { totalPrice, nights }
}

