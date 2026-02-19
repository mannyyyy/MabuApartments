import { NextResponse } from "next/server"
import { sendBookingConfirmationEmail, sendManagerNotificationEmail } from "@/utils/email"
import { createBookingApiSchema } from "@/lib/validators/booking-api.schema"
import {
  createBookingWithRoom,
  getRoomsOfTypeWithConflictingBookings,
  updateAvailabilityForBookingRange,
} from "@/services/booking.service"

export async function POST(req: Request) {
  try {
    const bookingData = createBookingApiSchema.parse(await req.json())
    console.log("Received booking data:", bookingData)

    const { guestName, guestEmail, checkIn, checkOut } = bookingData

    const booking = await createBookingWithRoom(bookingData)

    console.log("Booking created:", booking)

    const roomsOfType = await getRoomsOfTypeWithConflictingBookings(booking.room.roomTypeId, checkIn, checkOut)
    await updateAvailabilityForBookingRange(roomsOfType, checkIn, checkOut)

    console.log("Room availability updated")

    // Try to send emails but don't fail if they error
    try {
      // Send confirmation to guest
      await sendBookingConfirmationEmail(guestEmail, {
        guestName: guestName,
        roomType: booking.room.roomType.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: booking.totalPrice,
      })
      console.log("Booking confirmation email sent to guest")

      // Send notification to manager
      await sendManagerNotificationEmail({
        bookingId: booking.id,
        guestName: guestName,
        guestEmail: guestEmail,
        roomType: booking.room.roomType.name,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        totalPrice: booking.totalPrice,
      })
      console.log("Booking notification email sent to manager")
    } catch (emailError) {
      // Log the error but don't fail the booking
      console.error("Error sending emails:", emailError)
    }

    return NextResponse.json({ success: true, booking })
  } catch (error) {
    console.error("Error creating booking:", error)
    return NextResponse.json({ success: false, error: "Failed to create booking" }, { status: 500 })
  }
}
