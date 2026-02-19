import prisma from "../lib/db"
import {
  analyzePaymentConsistency,
  type BookingPaymentSnapshot,
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

  const snapshots: BookingPaymentSnapshot[] = bookings.map((booking) => ({
    id: booking.id,
    paymentStatus: booking.paymentStatus,
    paymentReference: booking.paymentReference,
    totalPrice: booking.totalPrice,
    createdAt: booking.createdAt,
  }))

  const result = analyzePaymentConsistency(snapshots, { now, pendingTimeoutHours })

  return {
    ...result,
    windowStart,
    windowDays,
  }
}
