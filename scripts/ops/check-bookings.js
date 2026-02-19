require("dotenv/config")
const { Prisma, PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()
const MAX_ROWS = 5

async function getRecentBookingRequests() {
  try {
    return await prisma.bookingRequest.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
      select: {
        id: true,
        fullName: true,
        email: true,
        paymentStatus: true,
        paymentReference: true,
        bookingId: true,
        createdAt: true,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return null
    }
    throw error
  }
}

async function main() {
  try {
    const bookings = await prisma.booking.findMany({
      include: {
        room: {
          include: {
            roomType: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    })

    console.log(`Recent bookings (${bookings.length}):`)
    bookings.forEach((booking, index) => {
      console.log(
        `${index + 1}. ${booking.id} | ${booking.guestName} | ${booking.guestEmail} | ${booking.room.roomType.name} (${booking.room.roomNumber}) | ${booking.paymentStatus} | ref=${booking.paymentReference || "none"}`,
      )
    })

    const requests = await getRecentBookingRequests()
    if (requests === null) {
      console.log("Recent booking requests: table not present in current schema")
      return
    }

    console.log(`Recent booking requests (${requests.length}):`)
    requests.forEach((request, index) => {
      console.log(
        `${index + 1}. ${request.id} | ${request.fullName} | ${request.email} | ${request.paymentStatus} | ref=${request.paymentReference || "none"} | booking=${request.bookingId || "none"}`,
      )
    })
  } catch (error) {
    console.error("Booking check failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
