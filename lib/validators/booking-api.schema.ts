import * as z from "zod"

export const createBookingApiSchema = z.object({
  roomId: z.string().min(1),
  guestName: z.string().min(1),
  guestEmail: z.string().email(),
  checkIn: z.string().min(1),
  checkOut: z.string().min(1),
  totalPrice: z.number(),
  paymentReference: z.string().min(1),
})

export type CreateBookingApiInput = z.infer<typeof createBookingApiSchema>

