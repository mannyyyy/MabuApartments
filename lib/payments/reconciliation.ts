export type BookingPaymentSnapshot = {
  id: string
  paymentStatus: string
  paymentReference: string | null
  totalPrice: number
  createdAt: Date
}

export type ReconciliationIssueCode =
  | "PAID_WITHOUT_REFERENCE"
  | "DUPLICATE_PAYMENT_REFERENCE"
  | "STALE_PENDING_PAYMENT"

export type ReconciliationIssue = {
  code: ReconciliationIssueCode
  message: string
  bookingIds: string[]
  paymentReference?: string
}

export type ReconciliationSummary = {
  scannedBookings: number
  paidBookings: number
  pendingBookings: number
  issueCount: number
}

export type ReconciliationResult = {
  summary: ReconciliationSummary
  issues: ReconciliationIssue[]
}

const PAID_STATUSES = new Set(["paid", "success"])
const PENDING_STATUSES = new Set(["pending", "processing", "initiated"])

function normalizeStatus(value: string) {
  return value.trim().toLowerCase()
}

export function analyzePaymentConsistency(
  bookings: BookingPaymentSnapshot[],
  options: { now?: Date; pendingTimeoutHours?: number } = {},
): ReconciliationResult {
  const now = options.now ?? new Date()
  const pendingTimeoutHours = options.pendingTimeoutHours ?? 24
  const staleCutoff = now.getTime() - pendingTimeoutHours * 60 * 60 * 1000

  const issues: ReconciliationIssue[] = []
  const referenceToBookings = new Map<string, string[]>()

  let paidBookings = 0
  let pendingBookings = 0

  for (const booking of bookings) {
    const status = normalizeStatus(booking.paymentStatus)
    const reference = booking.paymentReference?.trim() ?? ""

    if (PAID_STATUSES.has(status)) {
      paidBookings += 1
      if (!reference) {
        issues.push({
          code: "PAID_WITHOUT_REFERENCE",
          message: `Booking ${booking.id} is paid but has no payment reference.`,
          bookingIds: [booking.id],
        })
      }
    }

    if (PENDING_STATUSES.has(status)) {
      pendingBookings += 1
      if (booking.createdAt.getTime() < staleCutoff) {
        issues.push({
          code: "STALE_PENDING_PAYMENT",
          message: `Booking ${booking.id} has a stale pending payment older than ${pendingTimeoutHours}h.`,
          bookingIds: [booking.id],
        })
      }
    }

    if (reference) {
      const existing = referenceToBookings.get(reference) ?? []
      existing.push(booking.id)
      referenceToBookings.set(reference, existing)
    }
  }

  for (const [reference, bookingIds] of referenceToBookings) {
    if (bookingIds.length > 1) {
      issues.push({
        code: "DUPLICATE_PAYMENT_REFERENCE",
        message: `Payment reference ${reference} is used by multiple bookings.`,
        bookingIds,
        paymentReference: reference,
      })
    }
  }

  return {
    summary: {
      scannedBookings: bookings.length,
      paidBookings,
      pendingBookings,
      issueCount: issues.length,
    },
    issues,
  }
}

export function formatReconciliationReport(result: ReconciliationResult) {
  const lines = [
    "Payment Reconciliation Report",
    `Scanned bookings: ${result.summary.scannedBookings}`,
    `Paid bookings: ${result.summary.paidBookings}`,
    `Pending bookings: ${result.summary.pendingBookings}`,
    `Issues found: ${result.summary.issueCount}`,
  ]

  if (result.issues.length === 0) {
    lines.push("No issues detected.")
    return lines.join("\n")
  }

  for (const issue of result.issues) {
    const referencePart = issue.paymentReference ? ` | ref=${issue.paymentReference}` : ""
    lines.push(`[${issue.code}] ${issue.message}${referencePart} | bookings=${issue.bookingIds.join(",")}`)
  }

  return lines.join("\n")
}
