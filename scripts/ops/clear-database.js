require("dotenv/config")
const { Prisma, PrismaClient } = require("@prisma/client")
const { prompt } = require("enquirer")

const prisma = new PrismaClient()
const REQUIRED_CONFIRMATION_TEXT = "DELETE_ALL_DATA"

function assertSafetyGuards() {
  const allowDestructive = process.env.ALLOW_DB_DESTRUCTIVE === "true"
  const targetEnv = (process.env.TARGET_ENV || "").toLowerCase()
  const blockedTargets = new Set(["prod", "production"])

  if (!allowDestructive) {
    throw new Error("Blocked: set ALLOW_DB_DESTRUCTIVE=true to run this script.")
  }

  if (!targetEnv) {
    throw new Error("Blocked: set TARGET_ENV=development|staging|test before running.")
  }

  if (blockedTargets.has(targetEnv)) {
    throw new Error("Blocked: destructive operations are not allowed when TARGET_ENV is production.")
  }
}

async function deleteManyIfExists(modelName) {
  try {
    await prisma[modelName].deleteMany()
    console.log(`${modelName}: cleared`)
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      console.log(`${modelName}: table not present, skipped`)
      return
    }
    throw error
  }
}

async function main() {
  try {
    assertSafetyGuards()

    console.log("WARNING: This operation will delete data from the configured database.")
    console.log(`TARGET_ENV=${process.env.TARGET_ENV}`)

    const { confirm } = await prompt({
      type: "confirm",
      name: "confirm",
      message: "Proceed with database clear?",
      initial: false,
    })

    if (!confirm) {
      console.log("Cancelled.")
      return
    }

    const { typed } = await prompt({
      type: "input",
      name: "typed",
      message: `Type ${REQUIRED_CONFIRMATION_TEXT} to continue`,
    })

    if (typed !== REQUIRED_CONFIRMATION_TEXT) {
      console.log("Confirmation text mismatch. Cancelled.")
      return
    }

    await deleteManyIfExists("review")
    await deleteManyIfExists("availability")
    await deleteManyIfExists("bookingRequest")
    await deleteManyIfExists("booking")
    await deleteManyIfExists("room")
    await deleteManyIfExists("roomType")

    console.log("Database clear completed.")
  } catch (error) {
    console.error("Database clear failed:", error.message || error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
