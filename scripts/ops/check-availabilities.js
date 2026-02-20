require("dotenv/config")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const MS_PER_DAY = 24 * 60 * 60 * 1000
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

function dayKeyToEpochDay(dayKey) {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  return Math.floor(Date.UTC(year, month - 1, day, 0, 0, 0, 0) / MS_PER_DAY)
}

function epochDayToDayKey(epochDay) {
  return toLagosDayKey(new Date(epochDay * MS_PER_DAY))
}

function toUtcMidnightFromDayKey(dayKey) {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0))
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

function getAuditHorizonDays() {
  const raw = process.env.AVAILABILITY_AUDIT_DAYS
  if (!raw) {
    return 30
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error("AVAILABILITY_AUDIT_DAYS must be a positive number")
  }

  return Math.floor(parsed)
}

async function main() {
  try {
    const horizonDays = getAuditHorizonDays()
    const startDay = toLagosDayKey(new Date())
    const startEpochDay = dayKeyToEpochDay(startDay)
    const endEpochDay = startEpochDay + horizonDays
    const endDay = epochDayToDayKey(endEpochDay)

    const startDate = toUtcMidnightFromDayKey(startDay)
    const endDate = toUtcMidnightFromDayKey(endDay)

    const rooms = await prisma.room.findMany({
      include: {
        roomType: true,
        bookings: {
          where: {
            checkOut: {
              gt: startDate,
            },
            checkIn: {
              lt: new Date(endDate.getTime() + MS_PER_DAY),
            },
          },
          select: {
            checkIn: true,
            checkOut: true,
          },
        },
      },
      orderBy: {
        roomNumber: "asc",
      },
    })

    const availabilityRows = await prisma.availability.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        roomId: true,
        date: true,
        isAvailable: true,
      },
    })

    if (rooms.length === 0) {
      console.log("No rooms found.")
      return
    }

    const availabilityMap = new Map()
    availabilityRows.forEach((row) => {
      const dayKey = row.date.toISOString().slice(0, 10)
      availabilityMap.set(`${row.roomId}|${dayKey}`, row.isAvailable)
    })

    let expectedSlots = 0
    let presentSlots = 0
    let missingSlots = 0
    let mismatchSlots = 0

    const perRoomReport = rooms.map((room) => {
      let roomExpected = 0
      let roomPresent = 0
      let roomMissing = 0
      let roomMismatch = 0

      for (let epochDay = startEpochDay; epochDay <= endEpochDay; epochDay += 1) {
        const dayKey = epochDayToDayKey(epochDay)
        const nextDayKey = epochDayToDayKey(epochDay + 1)
        const isBooked = room.bookings.some((booking) =>
          bookingRangesOverlapByDay(dayKey, nextDayKey, booking.checkIn, booking.checkOut),
        )
        const expectedAvailability = !isBooked
        const mapKey = `${room.id}|${dayKey}`

        expectedSlots += 1
        roomExpected += 1

        if (!availabilityMap.has(mapKey)) {
          missingSlots += 1
          roomMissing += 1
          continue
        }

        presentSlots += 1
        roomPresent += 1

        const storedAvailability = availabilityMap.get(mapKey)
        if (storedAvailability !== expectedAvailability) {
          mismatchSlots += 1
          roomMismatch += 1
        }
      }

      return {
        roomNumber: room.roomNumber,
        roomType: room.roomType.name,
        expectedSlots: roomExpected,
        presentSlots: roomPresent,
        missingSlots: roomMissing,
        mismatchSlots: roomMismatch,
      }
    })

    console.log(`Availability audit window: ${startDay} -> ${endDay} (${horizonDays + 1} days)`)
    console.log(`Rooms: ${rooms.length}`)
    console.log(`Expected slots: ${expectedSlots}`)
    console.log(`Present slots: ${presentSlots}`)
    console.log(`Missing slots: ${missingSlots}`)
    console.log(`Mismatched slots: ${mismatchSlots}`)

    console.log("Per-room coverage:")
    perRoomReport.forEach((room) => {
      console.log(
        `- ${room.roomNumber} (${room.roomType}) expected=${room.expectedSlots} present=${room.presentSlots} missing=${room.missingSlots} mismatched=${room.mismatchSlots}`,
      )
    })
  } catch (error) {
    console.error("Availability check failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
