import * as z from "zod"

export const checkAvailabilitySchema = z.object({
  roomTypeId: z.string().min(1),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
})

export const unavailableDatesQuerySchema = z.object({
  roomTypeId: z.string().min(1, "Room Type ID is required"),
})

export type CheckAvailabilityInput = z.infer<typeof checkAvailabilitySchema>

