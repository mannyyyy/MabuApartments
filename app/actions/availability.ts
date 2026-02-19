"use server"

import { checkAvailabilitySchema, unavailableDatesQuerySchema } from "@/lib/validators/availability.schema"
import { findAvailableRoom, getUnavailableDatesForRoomType } from "@/services/availability.service"

export async function checkAvailabilityAction(input: unknown) {
  const parsedInput = checkAvailabilitySchema.parse(input)
  const room = await findAvailableRoom(parsedInput)

  if (!room) {
    return { available: false }
  }

  return {
    available: true,
    roomId: room.id,
  }
}

export async function getUnavailableDatesAction(input: unknown) {
  const parsedInput = unavailableDatesQuerySchema.parse(input)
  const unavailableDates = await getUnavailableDatesForRoomType(parsedInput.roomTypeId)

  return {
    unavailableDates,
  }
}
