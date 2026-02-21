const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const BOOKING_TIMEZONE = "Africa/Lagos"
export const CHECK_IN_HOUR = 12
export const CHECK_IN_MINUTE = 45
export const CHECK_OUT_HOUR = 11
export const CHECK_OUT_MINUTE = 45
export const IMMEDIATE_CHECK_IN_BUFFER_MINUTES = 30

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: BOOKING_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

const offsetFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BOOKING_TIMEZONE,
  timeZoneName: "shortOffset",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

type DayParts = {
  year: number
  month: number
  day: number
}

function parseDayKey(dayKey: string): DayParts {
  if (!DAY_KEY_PATTERN.test(dayKey)) {
    throw new Error(`Invalid booking day key: ${dayKey}`)
  }

  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid booking day key: ${dayKey}`)
  }

  return { year, month, day }
}

function getOffsetMinutesAtInstant(date: Date) {
  const timeZoneName = offsetFormatter.formatToParts(date).find((part) => part.type === "timeZoneName")?.value ?? "GMT"
  if (timeZoneName === "GMT") {
    return 0
  }

  const match = timeZoneName.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/)
  if (!match) {
    throw new Error(`Unsupported timezone offset format: ${timeZoneName}`)
  }

  const [, sign, hourRaw, minuteRaw] = match
  const hours = Number(hourRaw)
  const minutes = Number(minuteRaw ?? "0")
  const total = hours * 60 + minutes
  return sign === "+" ? total : -total
}

function toZonedInstant(dayKey: string, hour: number, minute: number) {
  const { year, month, day } = parseDayKey(dayKey)
  const utcMillis = Date.UTC(year, month - 1, day, hour, minute, 0, 0)
  const utcGuess = new Date(utcMillis)
  const offsetMinutes = getOffsetMinutesAtInstant(utcGuess)
  return new Date(utcMillis - offsetMinutes * 60 * 1000)
}

function asDate(input: Date | string) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid date input")
  }
  return date
}

export function toLagosBookingDayKey(input: Date | string) {
  const date = asDate(input)
  const parts = dayKeyFormatter.formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Could not format booking day key")
  }

  return `${year}-${month}-${day}`
}

export function toLagosCheckInInstant(input: Date | string) {
  return toZonedInstant(toLagosBookingDayKey(input), CHECK_IN_HOUR, CHECK_IN_MINUTE)
}

export function toLagosCheckOutInstant(input: Date | string) {
  return toZonedInstant(toLagosBookingDayKey(input), CHECK_OUT_HOUR, CHECK_OUT_MINUTE)
}

export function resolveRoomCheckInInstant(input: {
  requestedCheckIn: Date | string
  roomOccupiedNow: boolean
  now?: Date
  immediateBufferMinutes?: number
}) {
  const now = input.now ?? new Date()
  const requestedDay = toLagosBookingDayKey(input.requestedCheckIn)
  const currentDay = toLagosBookingDayKey(now)

  if (requestedDay !== currentDay || input.roomOccupiedNow) {
    return toLagosCheckInInstant(requestedDay)
  }

  const bufferMinutes = input.immediateBufferMinutes ?? IMMEDIATE_CHECK_IN_BUFFER_MINUTES
  return new Date(now.getTime() + bufferMinutes * 60 * 1000)
}

export function toUtcMidnightFromDayKey(dayKey: string) {
  const { year, month, day } = parseDayKey(dayKey)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

export function toLagosNowDayKey(now: Date = new Date()) {
  return toLagosBookingDayKey(now)
}

export function dayKeyToEpochDay(dayKey: string) {
  const { year, month, day } = parseDayKey(dayKey)
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0, 0) / MS_PER_DAY)
}

export function epochDayToDayKey(epochDay: number) {
  return toLagosBookingDayKey(new Date(epochDay * MS_PER_DAY))
}

export function iterateBookingDayKeys(startInput: Date | string, endInput: Date | string) {
  const startEpoch = dayKeyToEpochDay(toLagosBookingDayKey(startInput))
  const endEpoch = dayKeyToEpochDay(toLagosBookingDayKey(endInput))

  const days: string[] = []
  for (let day = startEpoch; day < endEpoch; day += 1) {
    days.push(epochDayToDayKey(day))
  }

  return days
}

export function bookingRangesOverlapByDay(
  leftCheckIn: Date | string,
  leftCheckOut: Date | string,
  rightCheckIn: Date | string,
  rightCheckOut: Date | string,
) {
  const leftStart = dayKeyToEpochDay(toLagosBookingDayKey(leftCheckIn))
  const leftEnd = dayKeyToEpochDay(toLagosBookingDayKey(leftCheckOut))
  const rightStart = dayKeyToEpochDay(toLagosBookingDayKey(rightCheckIn))
  const rightEnd = dayKeyToEpochDay(toLagosBookingDayKey(rightCheckOut))

  if (leftStart >= leftEnd || rightStart >= rightEnd) {
    return false
  }

  return leftStart < rightEnd && rightStart < leftEnd
}
