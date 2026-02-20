import prisma from "@/lib/db"
import type { CreateBookingApiInput } from "@/lib/validators/booking-api.schema"
import {
  bookingRangesOverlapByDay,
  dayKeyToEpochDay,
  epochDayToDayKey,
  iterateBookingDayKeys,
  resolveRoomCheckInInstant,
  toLagosBookingDayKey,
  toLagosCheckInInstant,
  toLagosCheckOutInstant,
  toUtcMidnightFromDayKey,
} from "@/lib/booking-time-policy"

export async function createBookingWithRoom(input: CreateBookingApiInput) {
  const now = new Date()
  const activeBooking = await prisma.booking.findFirst({
    where: {
      roomId: input.roomId,
      checkIn: { lte: now },
      checkOut: { gt: now },
    },
    select: { id: true },
  })

  const normalizedCheckIn = resolveRoomCheckInInstant({
    requestedCheckIn: input.checkIn,
    roomOccupiedNow: Boolean(activeBooking),
    now,
  })
  const normalizedCheckOut = toLagosCheckOutInstant(input.checkOut)

  return prisma.booking.create({
    data: {
      roomId: input.roomId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      checkIn: normalizedCheckIn,
      checkOut: normalizedCheckOut,
      totalPrice: input.totalPrice,
      paymentStatus: "paid",
      paymentReference: input.paymentReference,
    },
    include: {
      room: {
        include: {
          roomType: true,
        },
      },
    },
  })
}

export async function getRoomsOfTypeWithConflictingBookings(roomTypeId: string, checkIn: string, checkOut: string) {
  const checkInInstant = toLagosCheckInInstant(checkIn)
  const checkOutInstant = toLagosCheckOutInstant(checkOut)

  return prisma.room.findMany({
    where: {
      roomTypeId,
    },
    include: {
      bookings: {
        where: {
          checkIn: {
            lt: checkOutInstant,
          },
          checkOut: {
            gt: checkInInstant,
          },
        },
      },
    },
  })
}

async function upsertAvailability(roomId: string, dayKey: string, isAvailable: boolean) {
  const date = toUtcMidnightFromDayKey(dayKey)
  await prisma.availability.upsert({
    where: {
      roomId_date: {
        roomId,
        date,
      },
    },
    create: {
      roomId,
      date,
      isAvailable,
    },
    update: {
      isAvailable,
    },
  })
}

export async function updateAvailabilityForBookingRange(
  roomsOfType: Awaited<ReturnType<typeof getRoomsOfTypeWithConflictingBookings>>,
  checkIn: string,
  checkOut: string,
) {
  const days = iterateBookingDayKeys(checkIn, checkOut)

  for (const dayKey of days) {
    const nextDayKey = epochDayToDayKey(dayKeyToEpochDay(dayKey) + 1)
    await Promise.all(
      roomsOfType.map(async (room) => {
        const hasBooking = room.bookings.some((booking) =>
          bookingRangesOverlapByDay(dayKey, nextDayKey, booking.checkIn, booking.checkOut),
        )
        await upsertAvailability(room.id, dayKey, !hasBooking)
      }),
    )
  }
}

async function checkAvailability(roomId: string, startDate: Date, endDate: Date): Promise<boolean> {
  const checkInDay = toLagosBookingDayKey(startDate)
  const checkOutDay = toLagosBookingDayKey(endDate)
  if (dayKeyToEpochDay(checkInDay) >= dayKeyToEpochDay(checkOutDay)) {
    return false
  }

  const checkInInstant = toLagosCheckInInstant(startDate)
  const checkOutInstant = toLagosCheckOutInstant(endDate)

  const conflicts = await prisma.booking.findMany({
    where: {
      roomId,
      checkIn: {
        lt: checkOutInstant,
      },
      checkOut: {
        gt: checkInInstant,
      },
    },
    select: {
      checkIn: true,
      checkOut: true,
    },
  })

  return !conflicts.some((booking) => bookingRangesOverlapByDay(checkInDay, checkOutDay, booking.checkIn, booking.checkOut))
}

async function updateRoomAvailability(roomId: string, startDate: Date, endDate: Date, isAvailable: boolean) {
  const dayKeys = iterateBookingDayKeys(startDate, endDate)
  for (const dayKey of dayKeys) {
    await upsertAvailability(roomId, dayKey, isAvailable)
  }
}

export async function extendBookingAndUpdateAvailability(bookingId: string, newCheckOut: Date) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      room: {
        include: {
          roomType: true,
        },
      },
    },
  })

  if (!booking) {
    return { status: "not_found" as const }
  }

  const currentCheckOut = toLagosCheckOutInstant(booking.checkOut)
  const requestedCheckOut = toLagosCheckOutInstant(newCheckOut)
  if (requestedCheckOut.getTime() <= currentCheckOut.getTime()) {
    return { status: "unavailable" as const }
  }

  const isAvailable = await checkAvailability(booking.roomId, currentCheckOut, requestedCheckOut)
  if (!isAvailable) {
    return { status: "unavailable" as const }
  }

  const additionalNights =
    dayKeyToEpochDay(toLagosBookingDayKey(requestedCheckOut)) - dayKeyToEpochDay(toLagosBookingDayKey(currentCheckOut))
  const additionalPrice = additionalNights * booking.room.roomType.price

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checkOut: requestedCheckOut,
      totalPrice: booking.totalPrice + additionalPrice,
    },
  })

  await updateRoomAvailability(booking.roomId, currentCheckOut, requestedCheckOut, false)

  return { status: "updated" as const, booking: updatedBooking }
}
