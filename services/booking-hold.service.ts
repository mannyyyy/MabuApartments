import { Prisma } from "@prisma/client"
import prisma from "@/lib/db"
import { getBookingHoldExpiresAt } from "@/lib/booking-hold-policy"
import { toLagosBookingDayKey, toUtcMidnightFromDayKey } from "@/lib/booking-time-policy"
import { findAvailableRoom } from "@/services/availability.service"

type ReserveRoomHoldInput = {
  bookingRequestId: string
  roomTypeId: string
  checkIn: string
  checkOut: string
}

type BookingHoldStatus = "active" | "converted" | "expired" | "released"

const HOLD_ACTIVE_STATUS: BookingHoldStatus = "active"
const HOLD_CONVERTED_STATUS: BookingHoldStatus = "converted"
const HOLD_EXPIRED_STATUS: BookingHoldStatus = "expired"
const HOLD_RELEASED_STATUS: BookingHoldStatus = "released"

function normalizeBookingDayToDate(input: string) {
  return toUtcMidnightFromDayKey(toLagosBookingDayKey(input))
}

async function acquireRoomTypeInventoryLock(tx: Prisma.TransactionClient, roomTypeId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomTypeId}))`
}

export async function expireStaleBookingHolds(now: Date = new Date()) {
  return prisma.bookingHold.updateMany({
    where: {
      status: HOLD_ACTIVE_STATUS,
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: HOLD_EXPIRED_STATUS,
    },
  })
}

export async function reserveRoomHoldForBookingRequest(input: ReserveRoomHoldInput) {
  const maxAttempts = 3
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const now = new Date()
    const expiresAt = getBookingHoldExpiresAt(now)
    const arrivalDate = normalizeBookingDayToDate(input.checkIn)
    const departureDate = normalizeBookingDayToDate(input.checkOut)

    try {
      return await prisma.$transaction(
        async (tx) => {
          await acquireRoomTypeInventoryLock(tx, input.roomTypeId)

          await tx.bookingHold.updateMany({
            where: {
              status: HOLD_ACTIVE_STATUS,
              expiresAt: {
                lte: now,
              },
            },
            data: {
              status: HOLD_EXPIRED_STATUS,
            },
          })

          const availableRoom = await findAvailableRoom(
            {
              roomTypeId: input.roomTypeId,
              checkIn: input.checkIn,
              checkOut: input.checkOut,
            },
            {
              db: tx,
              now,
              excludeBookingRequestId: input.bookingRequestId,
            },
          )

          if (!availableRoom) {
            return null
          }

          return tx.bookingHold.upsert({
            where: {
              bookingRequestId: input.bookingRequestId,
            },
            create: {
              bookingRequestId: input.bookingRequestId,
              roomId: availableRoom.id,
              roomTypeId: input.roomTypeId,
              arrivalDate,
              departureDate,
              expiresAt,
              status: HOLD_ACTIVE_STATUS,
            },
            update: {
              roomId: availableRoom.id,
              roomTypeId: input.roomTypeId,
              arrivalDate,
              departureDate,
              expiresAt,
              paymentReference: null,
              status: HOLD_ACTIVE_STATUS,
            },
          })
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        },
      )
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034" &&
        attempt < maxAttempts
      ) {
        continue
      }

      throw error
    }
  }

  return null
}

export async function getActiveBookingHoldByRequestId(bookingRequestId: string, now: Date = new Date()) {
  return prisma.bookingHold.findFirst({
    where: {
      bookingRequestId,
      status: HOLD_ACTIVE_STATUS,
      expiresAt: {
        gt: now,
      },
    },
  })
}

export async function saveBookingHoldPaymentReference(bookingRequestId: string, paymentReference: string) {
  return prisma.bookingHold.updateMany({
    where: {
      bookingRequestId,
      status: HOLD_ACTIVE_STATUS,
    },
    data: {
      paymentReference,
    },
  })
}

export async function markBookingHoldAsConverted(bookingRequestId: string) {
  return prisma.bookingHold.updateMany({
    where: {
      bookingRequestId,
      status: HOLD_ACTIVE_STATUS,
    },
    data: {
      status: HOLD_CONVERTED_STATUS,
    },
  })
}

export async function markBookingHoldAsReleased(bookingRequestId: string) {
  return prisma.bookingHold.updateMany({
    where: {
      bookingRequestId,
      status: HOLD_ACTIVE_STATUS,
    },
    data: {
      status: HOLD_RELEASED_STATUS,
    },
  })
}
