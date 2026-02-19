require("dotenv/config")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

const PRICE_UPDATES = [
  { slug: "studio-apartment", price: 85000 },
  { slug: "one-bedroom-apartment", price: 120000 },
  { slug: "two-bedroom-apartment", price: 180000 },
]

function hasFlag(flag) {
  return process.argv.includes(flag)
}

async function main() {
  const isDryRun = hasFlag("--dry-run") || !hasFlag("--confirm")

  try {
    console.log(isDryRun ? "Running in dry-run mode. No DB changes will be written." : "Applying price updates.")

    for (const item of PRICE_UPDATES) {
      const existing = await prisma.roomType.findUnique({
        where: { slug: item.slug },
        select: { id: true, name: true, price: true },
      })

      if (!existing) {
        console.error(`Missing room type for slug: ${item.slug}`)
        process.exitCode = 1
        continue
      }

      console.log(`${existing.name}: ${existing.price} -> ${item.price}`)

      if (!isDryRun) {
        await prisma.roomType.update({
          where: { id: existing.id },
          data: { price: item.price },
        })
      }
    }

    if (isDryRun) {
      console.log("Dry-run complete. Re-run with --confirm to apply updates.")
    } else if (!process.exitCode) {
      console.log("Price updates applied successfully.")
    }
  } catch (error) {
    console.error("Price update failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
