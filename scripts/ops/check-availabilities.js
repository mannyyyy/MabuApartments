require("dotenv/config")
const { PrismaClient } = require("@prisma/client")

const prisma = new PrismaClient()

async function main() {
  try {
    const roomTypes = await prisma.roomType.findMany({
      include: {
        rooms: {
          include: {
            _count: {
              select: { availability: true },
            },
          },
        },
      },
      orderBy: {
        name: "asc",
      },
    })

    if (roomTypes.length === 0) {
      console.log("No room types found.")
      return
    }

    roomTypes.forEach((roomType) => {
      const totalAvailabilityRecords = roomType.rooms.reduce((sum, room) => sum + room._count.availability, 0)
      console.log(`${roomType.name}: rooms=${roomType.rooms.length}, availability_records=${totalAvailabilityRecords}`)
      roomType.rooms.forEach((room) => {
        console.log(`  - ${room.roomNumber}: availability_records=${room._count.availability}`)
      })
    })
  } catch (error) {
    console.error("Availability check failed:", error)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main()
