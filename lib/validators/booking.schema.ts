import * as z from "zod"

export type BookingDateRange = {
  from: Date | undefined
  to?: Date | undefined
}

export const bookingFormSchema = z.object({
  name: z.string().min(2, {
    message: "Name must be at least 2 characters.",
  }),
  email: z.string().email({
    message: "Please enter a valid email address.",
  }),
  dateRange: z.object({
    from: z.date().optional(),
    to: z.date().optional(),
  }),
})

export type BookingFormValues = z.infer<typeof bookingFormSchema>

