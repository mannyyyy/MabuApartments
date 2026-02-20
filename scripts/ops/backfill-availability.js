require("dotenv/config")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const BOOKING_TIMEZONE = "Africa/Lagos"

function asDate(input) {
  const date = input instanceof Date ? input : new Date(input)
  if (Number.isNaN(date.getTime())) {
    throw new RangeError("Invalid time value")
  }
  return date
}

function toLagosDayKey(input = new Date()) {
  const date = asDate(input)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BOOKING_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)

  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value

  if (!year || !month || !day) {
    throw new Error("Could not derive Lagos day key")
  }

  return `${year}-${month}-${day}`
}

function parseDayKey(dayKey) {
  if (!DAY_KEY_PATTERN.test(dayKey)) {
    throw new Error(`Invalid day key: ${dayKey}`)
  }

  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`Invalid day key: ${dayKey}`)
  }

  return { year, month, day }
}

function dayKeyToEpochDay(dayKey) {
  const { year, month, day } = parseDayKey(dayKey)
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0, 0) / MS_PER_DAY)
}

function epochDayToDayKey(epochDay) {
  return toLagosDayKey(new Date(epochDay * MS_PER_DAY))
}

function toUtcMidnightFromDayKey(dayKey) {
  const { year, month, day } = parseDayKey(dayKey)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
}

function toLagosCheckInInstant(dayKey) {
  const { year, month, day } = parseDayKey(dayKey)
  return new Date(Date.UTC(year, month - 1, day, 11, 45, 0, 0))
}

function toLagosDayRangeEndInstant(dayKey) {
  const endDay = epochDayToDayKey(dayKeyToEpochDay(dayKey) + 1)
  return toLagosCheckInInstant(endDay)
}

function bookingRangesOverlapByDay(leftCheckIn, leftCheckOut, rightCheckIn, rightCheckOut) {
  const leftStart = dayKeyToEpochDay(toLagosDayKey(leftCheckIn))
  const leftEnd = dayKeyToEpochDay(toLagosDayKey(leftCheckOut))
  const rightStart = dayKeyToEpochDay(toLagosDayKey(rightCheckIn))
  const rightEnd = dayKeyToEpochDay(toLagosDayKey(rightCheckOut))

  if (leftStart >= leftEnd || rightStart >= rightEnd) {
    return false
  }

  return leftStart < rightEnd && rightStart < leftEnd
}

function getConfiguredStartDay() {
  const configured = process.env.BACKFILL_START_DAY
  if (!configured) {
    return toLagosDayKey(new Date())
  }

  if (!DAY_KEY_PATTERN.test(configured)) {
    throw new Error("BACKFILL_START_DAY must use YYYY-MM-DD format")
  }

  return configured
}

function getConfiguredHorizonDays() {
  const raw = process.env.BACKFILL_AVAILABILITY_DAYS
  if (!raw) {
    return 365
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("BACKFILL_AVAILABILITY_DAYS must be a positive number")
  }

  return Math.floor(parsed)
}

async function main() {
  const startDay = getConfiguredStartDay()
  const horizonDays = getConfiguredHorizonDays()
  const startEpochDay = dayKeyToEpochDay(startDay)
  const endEpochDay = startEpochDay + horizonDays
  const endDay = epochDayToDayKey(endEpochDay)
  const windowStart = toLagosCheckInInstant(startDay)
  const windowEndExclusive = toLagosDayRangeEndInstant(endDay)

  const rooms = await prisma.room.findMany({
    include: {
      roomType: true,
      bookings: {
        where: {
          checkOut: { gt: windowStart },
          checkIn: { lt: windowEndExclusive },
        },
        select: {
          id: true,
          checkIn: true,
          checkOut: true,
        },
      },
    },
    orderBy: { roomNumber: "asc" },
  })

  let writeCount = 0
  for (const room of rooms) {
    for (let epochDay = startEpochDay; epochDay <= endEpochDay; epochDay += 1) {
      const dayKey = epochDayToDayKey(epochDay)
      const nextDayKey = epochDayToDayKey(epochDay + 1)
      const isBooked = room.bookings.some((booking) =>
        bookingRangesOverlapByDay(dayKey, nextDayKey, booking.checkIn, booking.checkOut),
      )

      await prisma.availability.upsert({
        where: {
          roomId_date: {
            roomId: room.id,
            date: toUtcMidnightFromDayKey(dayKey),
          },
        },
        create: {
          roomId: room.id,
          date: toUtcMidnightFromDayKey(dayKey),
          isAvailable: !isBooked,
        },
        update: {
          isAvailable: !isBooked,
        },
      })

      writeCount += 1
    }
  }

  console.log(`Backfill complete: rooms=${rooms.length}, days=${horizonDays + 1}, rows_written=${writeCount}`)
  console.log(`Window: ${startDay} -> ${endDay} (Africa/Lagos booking days)`)
}

main()
  .catch((error) => {
    console.error("Availability backfill failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
