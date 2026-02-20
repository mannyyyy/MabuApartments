require("dotenv/config")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  const now = new Date()

  const result = await prisma.bookingHold.updateMany({
    where: {
      status: "active",
      expiresAt: {
        lte: now,
      },
    },
    data: {
      status: "expired",
    },
  })

  console.log(
    JSON.stringify(
      {
        expiredCount: result.count,
        executedAt: now.toISOString(),
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error("Failed to expire booking holds:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
