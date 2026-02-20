import prisma from "@/lib/db"
import type { CheckAvailabilityInput } from "@/lib/validators/availability.schema"
import {
  bookingRangesOverlapByDay,
  dayKeyToEpochDay,
  epochDayToDayKey,
  toLagosBookingDayKey,
  toLagosCheckInInstant,
  toLagosCheckOutInstant,
  toLagosNowDayKey,
  toUtcMidnightFromDayKey,
} from "@/lib/booking-time-policy"

export async function findAvailableRoom(input: CheckAvailabilityInput) {
  const requestCheckInDay = toLagosBookingDayKey(input.checkIn)
  const requestCheckOutDay = toLagosBookingDayKey(input.checkOut)
  const requestCheckInInstant = toLagosCheckInInstant(input.checkIn)
  const requestCheckOutInstant = toLagosCheckOutInstant(input.checkOut)

  if (dayKeyToEpochDay(requestCheckInDay) >= dayKeyToEpochDay(requestCheckOutDay)) {
    return null
  }

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId: input.roomTypeId,
    },
    include: {
      bookings: {
        where: {
          checkIn: {
            lt: requestCheckOutInstant,
          },
          checkOut: {
            gt: requestCheckInInstant,
          },
        },
      },
    },
  })

  for (const room of rooms) {
    const hasConflict = room.bookings.some((booking) =>
      bookingRangesOverlapByDay(requestCheckInDay, requestCheckOutDay, booking.checkIn, booking.checkOut),
    )
    if (!hasConflict) {
      return room
    }
  }

  return null
}

export async function getUnavailableDatesForRoomType(roomTypeId: string) {
  const todayDay = toLagosNowDayKey()
  const startEpochDay = dayKeyToEpochDay(todayDay)
  const endEpochDay = startEpochDay + 365

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId,
    },
    include: {
      bookings: {
        where: {
          checkOut: {
            gt: toLagosCheckInInstant(todayDay),
          },
        },
      },
    },
  })

  const totalRooms = rooms.length
  const unavailableDates = new Set<string>()

  for (let epochDay = startEpochDay; epochDay <= endEpochDay; epochDay += 1) {
    const dayKey = epochDayToDayKey(epochDay)
    const nextDayKey = epochDayToDayKey(epochDay + 1)

    const bookedRoomsCount = rooms.filter((room) =>
      room.bookings.some((booking) => bookingRangesOverlapByDay(dayKey, nextDayKey, booking.checkIn, booking.checkOut)),
    ).length

    if (bookedRoomsCount >= totalRooms) {
      unavailableDates.add(dayKey)
    }
  }

  return Array.from(unavailableDates).map((dayKey) => toUtcMidnightFromDayKey(dayKey))
}
