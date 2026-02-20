export type BookingPaymentSnapshot = {
  id: string
  paymentStatus: string
  paymentReference: string | null
  totalPrice: number
  createdAt: Date
}

export type BookingRequestPaymentSnapshot = {
  id: string
  paymentStatus: string
  paymentReference: string | null
  bookingId: string | null
  createdAt: Date
}

export type ReconciliationIssueCode =
  | "PAID_WITHOUT_REFERENCE"
  | "DUPLICATE_PAYMENT_REFERENCE"
  | "STALE_PENDING_PAYMENT"
  | "PAID_REQUEST_WITHOUT_BOOKING"
  | "PAID_REQUEST_NEEDS_REVIEW"
  | "STALE_INITIATED_REQUEST"

export type ReconciliationIssue = {
  code: ReconciliationIssueCode
  message: string
  bookingIds: string[]
  paymentReference?: string
}

export type ReconciliationSummary = {
  scannedBookings: number
  scannedBookingRequests: number
  paidBookings: number
  pendingBookings: number
  initiatedBookingRequests: number
  reviewBookingRequests: number
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

type AnalyzeOptions = {
  now?: Date
  pendingTimeoutHours?: number
  bookingRequests?: BookingRequestPaymentSnapshot[]
}

export function analyzePaymentConsistency(
  bookings: BookingPaymentSnapshot[],
  options: AnalyzeOptions = {},
): ReconciliationResult {
  const now = options.now ?? new Date()
  const pendingTimeoutHours = options.pendingTimeoutHours ?? 24
  const bookingRequests = options.bookingRequests ?? []
  const staleCutoff = now.getTime() - pendingTimeoutHours * 60 * 60 * 1000

  const issues: ReconciliationIssue[] = []
  const referenceToEntities = new Map<string, string[]>()

  let paidBookings = 0
  let pendingBookings = 0
  let initiatedBookingRequests = 0
  let reviewBookingRequests = 0

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
      const existing = referenceToEntities.get(reference) ?? []
      existing.push(`booking:${booking.id}`)
      referenceToEntities.set(reference, existing)
    }
  }

  for (const request of bookingRequests) {
    const status = normalizeStatus(request.paymentStatus)
    const reference = request.paymentReference?.trim() ?? ""

    if (status === "initiated") {
      initiatedBookingRequests += 1
      if (request.createdAt.getTime() < staleCutoff) {
        issues.push({
          code: "STALE_INITIATED_REQUEST",
          message: `Booking request ${request.id} is stale in initiated state older than ${pendingTimeoutHours}h.`,
          bookingIds: [request.id],
        })
      }
    }

    if (status === "paid" && !request.bookingId) {
      issues.push({
        code: "PAID_REQUEST_WITHOUT_BOOKING",
        message: `Booking request ${request.id} is paid but is not linked to a booking.`,
        bookingIds: [request.id],
      })
    }

    if (status === "paid_needs_review") {
      reviewBookingRequests += 1
      issues.push({
        code: "PAID_REQUEST_NEEDS_REVIEW",
        message: `Booking request ${request.id} requires manual payment review.`,
        bookingIds: [request.id],
      })
    }

    if (reference) {
      const existing = referenceToEntities.get(reference) ?? []
      existing.push(`request:${request.id}`)
      referenceToEntities.set(reference, existing)
    }
  }

  for (const [reference, entities] of referenceToEntities) {
    if (entities.length > 1) {
      issues.push({
        code: "DUPLICATE_PAYMENT_REFERENCE",
        message: `Payment reference ${reference} is used by multiple records.`,
        bookingIds: entities,
        paymentReference: reference,
      })
    }
  }

  return {
    summary: {
      scannedBookings: bookings.length,
      scannedBookingRequests: bookingRequests.length,
      paidBookings,
      pendingBookings,
      initiatedBookingRequests,
      reviewBookingRequests,
      issueCount: issues.length,
    },
    issues,
  }
}

export function formatReconciliationReport(result: ReconciliationResult) {
  const lines = [
    "Payment Reconciliation Report",
    `Scanned bookings: ${result.summary.scannedBookings}`,
    `Scanned booking requests: ${result.summary.scannedBookingRequests}`,
    `Paid bookings: ${result.summary.paidBookings}`,
    `Pending bookings: ${result.summary.pendingBookings}`,
    `Initiated booking requests: ${result.summary.initiatedBookingRequests}`,
    `Review booking requests: ${result.summary.reviewBookingRequests}`,
    `Issues found: ${result.summary.issueCount}`,
  ]

  if (result.issues.length === 0) {
    lines.push("No issues detected.")
    return lines.join("\n")
  }

  for (const issue of result.issues) {
    const referencePart = issue.paymentReference ? ` | ref=${issue.paymentReference}` : ""
    lines.push(`[${issue.code}] ${issue.message}${referencePart} | records=${issue.bookingIds.join(",")}`)
  }

  return lines.join("\n")
}
