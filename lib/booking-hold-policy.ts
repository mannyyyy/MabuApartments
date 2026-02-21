import type { BookingHoldStatus } from "@prisma/client"

export const DEFAULT_BOOKING_HOLD_MINUTES = 15

function parseHoldMinutes(raw: string | undefined) {
  if (!raw) {
    return DEFAULT_BOOKING_HOLD_MINUTES
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BOOKING_HOLD_MINUTES
  }

  return Math.floor(parsed)
}

export function getBookingHoldMinutes() {
  return parseHoldMinutes(process.env.BOOKING_HOLD_MINUTES)
}

export function getBookingHoldExpiresAt(now: Date = new Date()) {
  return new Date(now.getTime() + getBookingHoldMinutes() * 60 * 1000)
}

export function isActiveBookingHold(input: {
  status: BookingHoldStatus
  expiresAt: Date
  now?: Date
}) {
  const now = input.now ?? new Date()
  return input.status === "active" && input.expiresAt.getTime() > now.getTime()
}
