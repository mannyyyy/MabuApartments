"use client"

import { useCallback, useEffect, useState } from "react"
import { useToast } from "@/hooks/use-toast"

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
      setUnavailableDates(data.unavailableDates.map((dateString: string) => new Date(dateString)))
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

