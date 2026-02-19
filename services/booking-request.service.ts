import prisma from "@/lib/db"
import type { BookingRequestInitiateInput } from "@/lib/validators/booking-request.schema"

type CreateBookingRequestInput = BookingRequestInitiateInput

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
    data: { paymentReference },
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

export async function markBookingRequestAsPaid(input: {
  bookingRequestId: string
  paymentReference: string
  bookingId: string
}) {
  return prisma.bookingRequest.update({
    where: { id: input.bookingRequestId },
    data: {
      paymentStatus: "paid",
      paymentReference: input.paymentReference,
      bookingId: input.bookingId,
    },
  })
}

export async function markBookingRequestAsFailed(id: string) {
  return prisma.bookingRequest.update({
    where: { id },
    data: { paymentStatus: "failed" },
  })
}
