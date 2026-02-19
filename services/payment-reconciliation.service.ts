import prisma from "../lib/db"
import { Prisma } from "@prisma/client"
import {
  analyzePaymentConsistency,
  type BookingPaymentSnapshot,
  type BookingRequestPaymentSnapshot,
  type ReconciliationResult,
} from "../lib/payments/reconciliation"

export type RunPaymentReconciliationOptions = {
  windowDays?: number
  pendingTimeoutHours?: number
  now?: Date
}

export type PaymentReconciliationReport = ReconciliationResult & {
  windowStart: Date
  windowDays: number
}

function isMissingBookingRequestTableError(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021" &&
    String(error.meta?.table || "").includes("BookingRequest")
  )
}

export async function runPaymentReconciliation(
  options: RunPaymentReconciliationOptions = {},
): Promise<PaymentReconciliationReport> {
  const now = options.now ?? new Date()
  const windowDays = options.windowDays ?? 14
  const pendingTimeoutHours = options.pendingTimeoutHours ?? 24
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)

  const bookings = await prisma.booking.findMany({
    where: {
      createdAt: {
        gte: windowStart,
      },
    },
    select: {
      id: true,
      paymentStatus: true,
      paymentReference: true,
      totalPrice: true,
      createdAt: true,
    },
  })

  let bookingRequests: Array<{
    id: string
    paymentStatus: string
    paymentReference: string | null
    bookingId: string | null
    createdAt: Date
  }> = []

  try {
    bookingRequests = await prisma.bookingRequest.findMany({
      where: {
        createdAt: {
          gte: windowStart,
        },
      },
      select: {
        id: true,
        paymentStatus: true,
        paymentReference: true,
        bookingId: true,
        createdAt: true,
      },
    })
  } catch (error) {
    if (!isMissingBookingRequestTableError(error)) {
      throw error
    }
  }

  const snapshots: BookingPaymentSnapshot[] = bookings.map((booking) => ({
    id: booking.id,
    paymentStatus: booking.paymentStatus,
    paymentReference: booking.paymentReference,
    totalPrice: booking.totalPrice,
    createdAt: booking.createdAt,
  }))

  const requestSnapshots: BookingRequestPaymentSnapshot[] = bookingRequests.map((item) => ({
    id: item.id,
    paymentStatus: item.paymentStatus,
    paymentReference: item.paymentReference,
    bookingId: item.bookingId,
    createdAt: item.createdAt,
  }))

  const result = analyzePaymentConsistency(snapshots, {
    now,
    pendingTimeoutHours,
    bookingRequests: requestSnapshots,
  })

  return {
    ...result,
    windowStart,
    windowDays,
  }
}
