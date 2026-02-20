import { Prisma } from "@prisma/client"
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

type AvailabilityDbClient = Prisma.TransactionClient | typeof prisma

type FindAvailableRoomOptions = {
  db?: AvailabilityDbClient
  now?: Date
  excludeBookingRequestId?: string
}

export async function findAvailableRoom(input: CheckAvailabilityInput, options: FindAvailableRoomOptions = {}) {
  const db = options.db ?? prisma
  const now = options.now ?? new Date()
  const requestCheckInDay = toLagosBookingDayKey(input.checkIn)
  const requestCheckOutDay = toLagosBookingDayKey(input.checkOut)
  const requestCheckInInstant = toLagosCheckInInstant(input.checkIn)
  const requestCheckOutInstant = toLagosCheckOutInstant(input.checkOut)

  if (dayKeyToEpochDay(requestCheckInDay) >= dayKeyToEpochDay(requestCheckOutDay)) {
    return null
  }

  const rooms = await db.room.findMany({
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
      bookingHolds: {
        where: {
          status: "active",
          expiresAt: {
            gt: now,
          },
          arrivalDate: {
            lt: requestCheckOutInstant,
          },
          departureDate: {
            gt: requestCheckInInstant,
          },
          ...(options.excludeBookingRequestId
            ? {
                bookingRequestId: {
                  not: options.excludeBookingRequestId,
                },
              }
            : {}),
        },
      },
    },
  })

  for (const room of rooms) {
    const hasBookingConflict = room.bookings.some((booking) =>
      bookingRangesOverlapByDay(requestCheckInDay, requestCheckOutDay, booking.checkIn, booking.checkOut),
    )
    const hasHoldConflict = room.bookingHolds.some((hold) =>
      bookingRangesOverlapByDay(requestCheckInDay, requestCheckOutDay, hold.arrivalDate, hold.departureDate),
    )

    if (!hasBookingConflict && !hasHoldConflict) {
      return room
    }
  }

  return null
}

export async function getUnavailableDatesForRoomType(roomTypeId: string) {
  const now = new Date()
  const todayDay = toLagosNowDayKey()
  const startEpochDay = dayKeyToEpochDay(todayDay)
  const endEpochDay = startEpochDay + 365
  const endWindowDay = epochDayToDayKey(endEpochDay + 1)

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
      bookingHolds: {
        where: {
          status: "active",
          expiresAt: {
            gt: now,
          },
          departureDate: {
            gt: toLagosCheckInInstant(todayDay),
          },
          arrivalDate: {
            lt: toLagosCheckInInstant(endWindowDay),
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

    const blockedRoomsCount = rooms.filter((room) => {
      const hasBooking = room.bookings.some((booking) =>
        bookingRangesOverlapByDay(dayKey, nextDayKey, booking.checkIn, booking.checkOut),
      )
      const hasHold = room.bookingHolds.some((hold) =>
        bookingRangesOverlapByDay(dayKey, nextDayKey, hold.arrivalDate, hold.departureDate),
      )

      return hasBooking || hasHold
    }).length

    if (blockedRoomsCount >= totalRooms) {
      unavailableDates.add(dayKey)
    }
  }

  return Array.from(unavailableDates).map((dayKey) => toUtcMidnightFromDayKey(dayKey))
}
