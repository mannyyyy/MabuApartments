"use server"

import { z } from "zod"
import { sendBookingConfirmationEmail, sendManagerNotificationEmail } from "@/utils/email"
import { createBookingApiSchema } from "@/lib/validators/booking-api.schema"
import {
  createBookingWithRoom,
  extendBookingAndUpdateAvailability,
  getRoomsOfTypeWithConflictingBookings,
  updateAvailabilityForBookingRange,
} from "@/services/booking.service"

const extendBookingActionSchema = z.object({
  bookingId: z.string().min(1),
  newCheckOut: z.string().min(1),
})

export async function createBookingAction(input: unknown) {
  const bookingData = createBookingApiSchema.parse(input)
  console.log("Received booking data:", bookingData)

  const { guestName, guestEmail, checkIn, checkOut } = bookingData
  const booking = await createBookingWithRoom(bookingData)

  console.log("Booking created:", booking)

  const roomsOfType = await getRoomsOfTypeWithConflictingBookings(booking.room.roomTypeId, checkIn, checkOut)
  await updateAvailabilityForBookingRange(roomsOfType, checkIn, checkOut)

  console.log("Room availability updated")

  // Keep booking successful even if email delivery fails.
  try {
    await sendBookingConfirmationEmail(guestEmail, {
      guestName,
      roomType: booking.room.roomType.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice,
    })
    console.log("Booking confirmation email sent to guest")

    await sendManagerNotificationEmail({
      bookingId: booking.id,
      guestName,
      guestEmail,
      roomType: booking.room.roomType.name,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      totalPrice: booking.totalPrice,
    })
    console.log("Booking notification email sent to manager")
  } catch (emailError) {
    console.error("Error sending emails:", emailError)
  }

  return { success: true, booking }
}

type ExtendBookingResult = {
  status: 200 | 400 | 404
  body: { message: string; booking?: unknown }
}

export async function extendBookingAction(input: unknown): Promise<ExtendBookingResult> {
  const { bookingId, newCheckOut } = extendBookingActionSchema.parse(input)
  const extensionResult = await extendBookingAndUpdateAvailability(bookingId, new Date(newCheckOut))

  if (extensionResult.status === "not_found") {
    return { status: 404, body: { message: "Booking not found" } }
  }

  if (extensionResult.status === "unavailable") {
    return { status: 400, body: { message: "Room not available for extension" } }
  }

  return {
    status: 200,
    body: {
      message: "Booking extended successfully",
      booking: extensionResult.booking,
    },
  }
}
