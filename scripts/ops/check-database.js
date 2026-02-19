require("dotenv/config")
const { Prisma, PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function safeCount(model) {
  try {
    return await prisma[model].count()
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return null
    }
    throw error
  }
}

async function main() {
  try {
    await prisma.$queryRaw`SELECT 1`

    const counts = {
      roomType: await safeCount("roomType"),
      room: await safeCount("room"),
      availability: await safeCount("availability"),
      booking: await safeCount("booking"),
      bookingRequest: await safeCount("bookingRequest"),
      review: await safeCount("review"),
    }

    console.log("Database connectivity: OK")
    Object.entries(counts).forEach(([model, count]) => {
      if (count === null) {
        console.log(`${model}: table not present in current schema`)
        return
      }
      console.log(`${model}: ${count}`)
    })
  } catch (error) {
    console.error("Database check failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
