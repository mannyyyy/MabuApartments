import prisma from "@/lib/db"
import { eachDayOfInterval } from "date-fns"
import type { CreateBookingApiInput } from "@/lib/validators/booking-api.schema"

export async function createBookingWithRoom(input: CreateBookingApiInput) {
  return prisma.booking.create({
    data: {
      roomId: input.roomId,
      guestName: input.guestName,
      guestEmail: input.guestEmail,
      checkIn: new Date(input.checkIn),
      checkOut: new Date(input.checkOut),
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
  return prisma.room.findMany({
    where: {
      roomTypeId,
    },
    include: {
      bookings: {
        where: {
          OR: [
            {
              AND: [{ checkIn: { lte: new Date(checkIn) } }, { checkOut: { gt: new Date(checkIn) } }],
            },
            {
              AND: [{ checkIn: { lt: new Date(checkOut) } }, { checkOut: { gte: new Date(checkOut) } }],
            },
          ],
        },
      },
    },
  })
}

export async function updateAvailabilityForBookingRange(
  roomsOfType: Awaited<ReturnType<typeof getRoomsOfTypeWithConflictingBookings>>,
  checkIn: string,
  checkOut: string,
) {
  const checkInDate = new Date(checkIn)
  const checkOutDate = new Date(checkOut)

  for (let date = new Date(checkInDate); date < checkOutDate; date.setDate(date.getTime() + 24 * 60 * 60 * 1000)) {
    const currentDate = new Date(date)

    const bookedRoomsCount = roomsOfType.filter((room) =>
      room.bookings.some((booking) => booking.checkIn <= currentDate && booking.checkOut > currentDate),
    ).length

    const isAvailable = bookedRoomsCount < roomsOfType.length

    await prisma.availability.updateMany({
      where: {
        roomId: {
          in: roomsOfType.map((room) => room.id),
        },
        date: currentDate,
      },
      data: {
        isAvailable,
      },
    })
  }
}

async function checkAvailability(roomId: string, startDate: Date, endDate: Date): Promise<boolean> {
  const availability = await prisma.availability.findMany({
    where: {
      roomId,
      date: {
        gte: startDate,
        lt: endDate,
      },
    },
  })

  return availability.every((item) => item.isAvailable)
}

async function updateRoomAvailability(roomId: string, startDate: Date, endDate: Date, isAvailable: boolean) {
  const dates = eachDayOfInterval({ start: startDate, end: endDate })

  for (const date of dates) {
    await prisma.availability.updateMany({
      where: {
        roomId,
        date,
      },
      data: {
        isAvailable,
      },
    })
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

  const isAvailable = await checkAvailability(booking.roomId, booking.checkOut, newCheckOut)
  if (!isAvailable) {
    return { status: "unavailable" as const }
  }

  const additionalNights = Math.ceil((newCheckOut.getTime() - booking.checkOut.getTime()) / (1000 * 3600 * 24))
  const additionalPrice = additionalNights * booking.room.roomType.price

  const updatedBooking = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      checkOut: newCheckOut,
      totalPrice: booking.totalPrice + additionalPrice,
    },
  })

  await updateRoomAvailability(booking.roomId, booking.checkOut, newCheckOut, false)

  return { status: "updated" as const, booking: updatedBooking }
}
