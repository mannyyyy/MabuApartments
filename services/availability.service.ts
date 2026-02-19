import { endOfDay, startOfDay } from "date-fns"
import prisma from "@/lib/db"
import type { CheckAvailabilityInput } from "@/lib/validators/availability.schema"

export async function findAvailableRoom(input: CheckAvailabilityInput) {
  const checkInDate = startOfDay(new Date(input.checkIn))
  const checkOutDate = endOfDay(new Date(input.checkOut))

  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId: input.roomTypeId,
    },
    include: {
      bookings: {
        where: {
          OR: [
            {
              AND: [{ checkIn: { lte: checkInDate } }, { checkOut: { gt: checkInDate } }],
            },
            {
              AND: [{ checkIn: { lt: checkOutDate } }, { checkOut: { gte: checkOutDate } }],
            },
          ],
        },
      },
    },
  })

  for (const room of rooms) {
    if (room.bookings.length === 0) {
      return room
    }
  }

  return null
}

export async function getUnavailableDatesForRoomType(roomTypeId: string) {
  const rooms = await prisma.room.findMany({
    where: {
      roomTypeId,
    },
    include: {
      bookings: {
        where: {
          checkOut: {
            gte: startOfDay(new Date()),
          },
        },
      },
    },
  })

  const totalRooms = rooms.length
  const unavailableDates = new Set<string>()

  for (
    let date = startOfDay(new Date());
    date <= endOfDay(new Date(Date.now() + 365 * 24 * 60 * 60 * 1000));
    date = new Date(date.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const bookedRoomsCount = rooms.filter((room) =>
      room.bookings.some((booking) => date >= startOfDay(booking.checkIn) && date < endOfDay(booking.checkOut)),
    ).length

    if (bookedRoomsCount >= totalRooms) {
      unavailableDates.add(date.toISOString().split("T")[0])
    }
  }

  return Array.from(unavailableDates).map((date) => new Date(date))
}

