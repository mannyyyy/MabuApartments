"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"

function toLocalNoonDate(dateInput: string) {
  const dayKey = dateInput.split("T")[0] ?? dateInput
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return new Date(dateInput)
  }

  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function useAvailability(roomTypeId: string) {
  const [unavailableDates, setUnavailableDates] = useState<Date[]>([])
  const { toast } = useToast()

  const fetchUnavailableDates = useCallback(async () => {
    try {
      const response = await fetch(`/api/unavailable-dates?roomTypeId=${roomTypeId}`)
      if (!response.ok) {
        throw new Error("Failed to fetch unavailable dates")
      }

      const data = await response.json()
      setUnavailableDates(data.unavailableDates.map((dateString: string) => toLocalNoonDate(dateString)))
    } catch (error) {
      console.error("Error fetching unavailable dates:", error)
      toast({
        title: "Error",
        description: "Failed to fetch unavailable dates. Please try again.",
        variant: "destructive",
      })
    }
  }, [roomTypeId, toast])

  useEffect(() => {
    fetchUnavailableDates()
  }, [fetchUnavailableDates])

  return { unavailableDates, refreshUnavailableDates: fetchUnavailableDates }
}
