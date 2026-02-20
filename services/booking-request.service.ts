import prisma from "@/lib/db"
import type { BookingRequestInitiateInput } from "@/lib/validators/booking-request.schema"

type CreateBookingRequestInput = BookingRequestInitiateInput

function getReuseWindowMinutes() {
  const raw = process.env.BOOKING_REQUEST_REUSE_WINDOW_MINUTES
  if (!raw) {
    return 10
  }

  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 10
  }

  return Math.floor(parsed)
}

export async function createBookingRequest(input: CreateBookingRequestInput, amountKobo: number) {
  return prisma.bookingRequest.create({
    data: {
      fullName: input.fullName,
      phoneNumber: input.phoneNumber,
      email: input.email,
      arrivalDate: new Date(input.arrivalDate),
      departureDate: new Date(input.departureDate),
      roomTypeId: input.roomTypeId,
      roomSpecification: input.roomSpecification,
      heardAboutUs: input.heardAboutUs,
      guestType: input.guestType,
      gender: input.gender,
      termsAccepted: input.termsConsent === "ACCEPT",
      officialIdUrl: input.officialId.url,
      officialIdMimeType: input.officialId.mimeType,
      officialIdOriginalName: input.officialId.originalName,
      officialIdSizeBytes: input.officialId.sizeBytes,
      amountKobo,
      paymentStatus: "initiated",
    },
  })
}

export async function saveBookingRequestPaymentReference(bookingRequestId: string, paymentReference: string) {
  return prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: {
      paymentStatus: "initiated",
      paymentReference,
      lastError: null,
    },
  })
}

export async function getBookingRequestById(id: string) {
  return prisma.bookingRequest.findUnique({
    where: { id },
  })
}

export async function getBookingRequestByReference(reference: string) {
  return prisma.bookingRequest.findUnique({
    where: { paymentReference: reference },
  })
}

export async function getBookingRequestByIdOrReference(id: string | null, reference: string) {
  if (id) {
    const byId = await getBookingRequestById(id)
    if (byId) {
      return byId
    }
  }
  return getBookingRequestByReference(reference)
}

export async function findLatestReusableBookingRequest(input: {
  email: string
  roomTypeId: string
  arrivalDate: string
  departureDate: string
  amountKobo: number
}) {
  const createdAfter = new Date(Date.now() - getReuseWindowMinutes() * 60 * 1000)

  return prisma.bookingRequest.findFirst({
    where: {
      email: input.email,
      roomTypeId: input.roomTypeId,
      arrivalDate: new Date(input.arrivalDate),
      departureDate: new Date(input.departureDate),
      amountKobo: input.amountKobo,
      paymentReference: null,
      paymentStatus: {
        in: ["initiated", "failed"],
      },
      createdAt: {
        gte: createdAfter,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })
}

export async function prepareBookingRequestForPaymentRetry(id: string) {
  return prisma.bookingRequest.update({
    where: { id },
    data: {
      paymentStatus: "initiated",
      lastError: null,
    },
  })
}

export async function recordBookingRequestInitError(id: string, reason: string) {
  return prisma.bookingRequest.update({
    where: { id },
    data: {
      lastError: reason,
    },
  })
}

export async function markBookingRequestAsPaid(input: {
  bookingRequestId: string
  paymentReference: string
  bookingId: string
  verifiedAmountKobo?: number | null
  verifiedCurrency?: string | null
}) {
  return prisma.bookingRequest.update({
    where: { id: input.bookingRequestId },
    data: {
      paymentStatus: "paid",
      paymentReference: input.paymentReference,
      bookingId: input.bookingId,
      reviewReason: null,
      lastError: null,
      webhookReceivedAt: new Date(),
      verifiedAmountKobo: input.verifiedAmountKobo ?? null,
      verifiedCurrency: input.verifiedCurrency ?? null,
    },
  })
}

export async function markBookingRequestAsFailed(id: string, reason?: string) {
  return prisma.bookingRequest.update({
    where: { id },
    data: {
      paymentStatus: "failed",
      lastError: reason ?? null,
    },
  })
}

export async function markBookingRequestAsPaidNeedsReview(input: {
  bookingRequestId: string
  paymentReference: string
  reviewReason: string
  lastError?: string | null
  verifiedAmountKobo?: number | null
  verifiedCurrency?: string | null
}) {
  return prisma.bookingRequest.update({
    where: { id: input.bookingRequestId },
    data: {
      paymentStatus: "paid_needs_review",
      paymentReference: input.paymentReference,
      reviewReason: input.reviewReason,
      lastError: input.lastError ?? null,
      webhookReceivedAt: new Date(),
      verifiedAmountKobo: input.verifiedAmountKobo ?? null,
      verifiedCurrency: input.verifiedCurrency ?? null,
    },
  })
}
