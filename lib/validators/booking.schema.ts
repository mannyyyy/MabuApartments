import * as z from "zod"

export type BookingDateRange = {
  from: Date | undefined
  to?: Date | undefined
}

export const bookingFormSchema = z
  .object({
    fullName: z.string().trim().min(2, {
      message: "Full name must be at least 2 characters.",
    }),
    phoneNumber: z.string().trim().min(7, {
      message: "Please enter a valid phone number.",
    }),
    email: z.string().email({
      message: "Please enter a valid email address.",
    }),
    roomSpecification: z.string().trim().min(1, {
      message: "Room specification is required.",
    }),
    heardAboutUs: z.string().trim().min(1, {
      message: "Please tell us where you heard about us.",
    }),
    guestType: z.enum(["NEW", "RETURNING"], {
      required_error: "Please select whether you are a returning guest.",
    }),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"], {
      required_error: "Please select a gender option.",
    }),
    termsConsent: z.enum(["ACCEPT", "DECLINE"], {
      required_error: "You must choose Accept or Decline for the terms.",
    }),
    dateRange: z.object({
      from: z.date().optional(),
      to: z.date().optional(),
    }),
  })
  .superRefine((input, ctx) => {
    if (input.termsConsent !== "ACCEPT") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "You must accept the terms and conditions to continue.",
        path: ["termsConsent"],
      })
    }
  })

export type BookingFormValues = z.infer<typeof bookingFormSchema>
