import test from "node:test"
import assert from "node:assert/strict"
import {
  DEFAULT_BOOKING_HOLD_MINUTES,
  getBookingHoldExpiresAt,
  getBookingHoldMinutes,
  isActiveBookingHold,
} from "../lib/booking-hold-policy"

test("getBookingHoldMinutes falls back to default for invalid env values", () => {
  const previous = process.env.BOOKING_HOLD_MINUTES
  process.env.BOOKING_HOLD_MINUTES = "invalid"

  assert.equal(getBookingHoldMinutes(), DEFAULT_BOOKING_HOLD_MINUTES)

  process.env.BOOKING_HOLD_MINUTES = previous
})

test("getBookingHoldExpiresAt adds configured minutes", () => {
  const previous = process.env.BOOKING_HOLD_MINUTES
  process.env.BOOKING_HOLD_MINUTES = "20"
  const now = new Date("2026-03-01T10:00:00.000Z")

  const expiresAt = getBookingHoldExpiresAt(now)
  assert.equal(expiresAt.toISOString(), "2026-03-01T10:20:00.000Z")

  process.env.BOOKING_HOLD_MINUTES = previous
})

test("isActiveBookingHold checks both status and expiry timestamp", () => {
  const now = new Date("2026-03-01T10:00:00.000Z")

  assert.equal(
    isActiveBookingHold({
      status: "active",
      expiresAt: new Date("2026-03-01T10:01:00.000Z"),
      now,
    }),
    true,
  )

  assert.equal(
    isActiveBookingHold({
      status: "active",
      expiresAt: new Date("2026-03-01T09:59:00.000Z"),
      now,
    }),
    false,
  )

  assert.equal(
    isActiveBookingHold({
      status: "released",
      expiresAt: new Date("2026-03-01T10:10:00.000Z"),
      now,
    }),
    false,
  )
})
