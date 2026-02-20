import * as z from "zod"
import { dayKeyToEpochDay, toLagosNowDayKey } from "../booking-time-policy"

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const allowedIdMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function isValidDayKey(dayKey: string) {
  if (!DAY_KEY_PATTERN.test(dayKey)) {
    return false
  }

  const [yearRaw, monthRaw, dayRaw] = dayKey.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  const date = new Date(Date.UTC(year, month - 1, day))

  return date.getUTCFullYear() === year && date.getUTCMonth() + 1 === month && date.getUTCDate() === day
}

const bookingDaySchema = z
  .string()
  .refine((value) => isValidDayKey(value), "Date must be in YYYY-MM-DD format.")

export const guestTypeSchema = z.enum(["NEW", "RETURNING"])
export const genderSchema = z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"])

export const uploadedOfficialIdSchema = z.object({
  url: z.string().url(),
  mimeType: z.enum(allowedIdMimeTypes),
  originalName: z.string().min(1),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})

export const bookingRequestInitiateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phoneNumber: z.string().trim().min(7).max(30),
    email: z.string().trim().email(),
    arrivalDate: bookingDaySchema,
    departureDate: bookingDaySchema,
    roomTypeId: z.string().min(1),
    roomSpecification: z.string().trim().min(1).max(120),
    heardAboutUs: z.string().trim().min(1).max(200),
    guestType: guestTypeSchema,
    gender: genderSchema,
    termsConsent: z.enum(["ACCEPT", "DECLINE"], {
      required_error: "You must choose Accept or Decline for the terms.",
    }),
    officialId: uploadedOfficialIdSchema,
  })
  .superRefine((input, ctx) => {
    let arrivalEpochDay: number
    let departureEpochDay: number
    try {
      arrivalEpochDay = dayKeyToEpochDay(input.arrivalDate)
      departureEpochDay = dayKeyToEpochDay(input.departureDate)
    } catch {
      return
    }

    const todayEpochDay = dayKeyToEpochDay(toLagosNowDayKey())

    if (arrivalEpochDay < todayEpochDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Arrival date cannot be in the past.",
        path: ["arrivalDate"],
      })
    }

    if (departureEpochDay <= arrivalEpochDay) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Departure date must be after arrival date.",
        path: ["departureDate"],
      })
    }

    if (input.termsConsent !== "ACCEPT") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Terms must be accepted before payment.",
        path: ["termsConsent"],
      })
    }
  })

export type BookingRequestInitiateInput = z.infer<typeof bookingRequestInitiateSchema>
export type UploadedOfficialId = z.infer<typeof uploadedOfficialIdSchema>

export const officialIdUploadSchema = z.object({
  mimeType: z.enum(allowedIdMimeTypes),
  sizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
})
