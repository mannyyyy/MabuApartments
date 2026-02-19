import prisma from "@/lib/db"
import RoomList from "@/components/RoomList"
import Hero from "@/components/Hero"

export const revalidate = 300

export default async function RoomsPage() {
  const roomTypes = await prisma.roomType.findMany()

  return (
    <div className="min-h-screen">
      <Hero title="Rooms & Suites" />
      <div className="container mx-auto px-4 py-16 bg-[#faf9f6]">
        {/* <h2 className="text-3xl font-bold mb-8">Our Rooms</h2> */}
        <RoomList roomTypes={roomTypes} />
      </div>
    </div>
  )
}
