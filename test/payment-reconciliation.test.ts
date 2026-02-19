import test from "node:test"
import assert from "node:assert/strict"
import {
  analyzePaymentConsistency,
  formatReconciliationReport,
  type BookingPaymentSnapshot,
} from "../lib/payments/reconciliation"

test("analyzePaymentConsistency detects missing refs, stale pending, and duplicate refs", () => {
  const now = new Date("2026-02-19T12:00:00.000Z")

  const bookings: BookingPaymentSnapshot[] = [
    {
      id: "booking_paid_missing_ref",
      paymentStatus: "paid",
      paymentReference: null,
      totalPrice: 100,
      createdAt: new Date("2026-02-19T10:00:00.000Z"),
    },
    {
      id: "booking_duplicate_ref_a",
      paymentStatus: "paid",
      paymentReference: "ref_123",
      totalPrice: 120,
      createdAt: new Date("2026-02-19T10:00:00.000Z"),
    },
    {
      id: "booking_duplicate_ref_b",
      paymentStatus: "success",
      paymentReference: "ref_123",
      totalPrice: 120,
      createdAt: new Date("2026-02-19T10:30:00.000Z"),
    },
    {
      id: "booking_stale_pending",
      paymentStatus: "pending",
      paymentReference: "ref_pending_1",
      totalPrice: 140,
      createdAt: new Date("2026-02-18T09:00:00.000Z"),
    },
  ]

  const result = analyzePaymentConsistency(bookings, { now, pendingTimeoutHours: 24 })
  const codes = result.issues.map((issue) => issue.code).sort()

  assert.deepEqual(codes, [
    "DUPLICATE_PAYMENT_REFERENCE",
    "PAID_WITHOUT_REFERENCE",
    "STALE_PENDING_PAYMENT",
  ])
  assert.equal(result.summary.scannedBookings, 4)
  assert.equal(result.summary.issueCount, 3)
})

test("formatReconciliationReport prints a stable summary", () => {
  const result = analyzePaymentConsistency([], { now: new Date("2026-02-19T12:00:00.000Z") })
  const report = formatReconciliationReport(result)

  assert.match(report, /Payment Reconciliation Report/)
  assert.match(report, /Scanned bookings: 0/)
  assert.match(report, /No issues detected\./)
})
