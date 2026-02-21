import test from "node:test"
import assert from "node:assert/strict"
import {
  bookingRangesOverlapByDay,
  resolveRoomCheckInInstant,
  iterateBookingDayKeys,
  toLagosBookingDayKey,
  toLagosCheckInInstant,
  toLagosCheckOutInstant,
  toUtcMidnightFromDayKey,
} from "../lib/booking-time-policy"

test("Lagos booking day key stays stable for day-only payload", () => {
  assert.equal(toLagosBookingDayKey("2026-03-10"), "2026-03-10")
})

test("Lagos policy check-in and check-out map to expected UTC instants", () => {
  assert.equal(toLagosCheckInInstant("2026-03-10").toISOString(), "2026-03-10T11:45:00.000Z")
  assert.equal(toLagosCheckOutInstant("2026-03-10").toISOString(), "2026-03-10T10:45:00.000Z")
})

test("booking day overlap allows same-day turnover", () => {
  const existingCheckIn = "2026-03-10"
  const existingCheckOut = "2026-03-12"

  assert.equal(bookingRangesOverlapByDay(existingCheckIn, existingCheckOut, "2026-03-12", "2026-03-14"), false)
  assert.equal(bookingRangesOverlapByDay(existingCheckIn, existingCheckOut, "2026-03-11", "2026-03-13"), true)
})

test("iterateBookingDayKeys uses start-inclusive and end-exclusive semantics", () => {
  assert.deepEqual(iterateBookingDayKeys("2026-03-10", "2026-03-13"), ["2026-03-10", "2026-03-11", "2026-03-12"])
})

test("toUtcMidnightFromDayKey returns day boundary instant", () => {
  assert.equal(toUtcMidnightFromDayKey("2026-03-10").toISOString(), "2026-03-10T00:00:00.000Z")
})

test("resolveRoomCheckInInstant keeps fixed check-in for future-day bookings", () => {
  const now = new Date("2026-03-10T08:00:00.000Z")
  const resolved = resolveRoomCheckInInstant({
    requestedCheckIn: "2026-03-11",
    roomOccupiedNow: false,
    now,
  })

  assert.equal(resolved.toISOString(), "2026-03-11T11:45:00.000Z")
})

test("resolveRoomCheckInInstant allows buffered immediate check-in for vacant same-day rooms", () => {
  const now = new Date("2026-03-10T08:00:00.000Z")
  const resolved = resolveRoomCheckInInstant({
    requestedCheckIn: "2026-03-10",
    roomOccupiedNow: false,
    now,
  })

  assert.equal(resolved.toISOString(), "2026-03-10T08:30:00.000Z")
})

test("resolveRoomCheckInInstant keeps fixed check-in for occupied same-day rooms", () => {
  const now = new Date("2026-03-10T08:00:00.000Z")
  const resolved = resolveRoomCheckInInstant({
    requestedCheckIn: "2026-03-10",
    roomOccupiedNow: true,
    now,
  })

  assert.equal(resolved.toISOString(), "2026-03-10T11:45:00.000Z")
})
