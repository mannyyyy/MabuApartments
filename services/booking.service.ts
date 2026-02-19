import prisma from "@/lib/db"
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

