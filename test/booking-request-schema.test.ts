import test from "node:test"
import assert from "node:assert/strict"
import { bookingRequestInitiateSchema } from "../lib/validators/booking-request.schema"

test("bookingRequestInitiateSchema validates required fields", () => {
  const valid = bookingRequestInitiateSchema.safeParse({
    fullName: "John Doe",
    phoneNumber: "+2348012345678",
    email: "john@example.com",
    arrivalDate: "2026-03-02",
    departureDate: "2026-03-05",
    roomTypeId: "roomType123",
    roomSpecification: "One Bedroom Apartment",
    heardAboutUs: "Instagram",
    guestType: "NEW",
    gender: "MALE",
    termsConsent: "ACCEPT",
    officialId: {
      url: "https://res.cloudinary.com/demo/image/upload/v1/file.jpg",
      mimeType: "image/jpeg",
      originalName: "id.jpg",
      sizeBytes: 1000,
    },
  })

  assert.equal(valid.success, true)
})

test("bookingRequestInitiateSchema rejects invalid dates and bad official id type", () => {
  const invalid = bookingRequestInitiateSchema.safeParse({
    fullName: "John Doe",
    phoneNumber: "+2348012345678",
    email: "john@example.com",
    arrivalDate: "2026-03-05",
    departureDate: "2026-03-02",
    roomTypeId: "roomType123",
    roomSpecification: "One Bedroom Apartment",
    heardAboutUs: "Instagram",
    guestType: "NEW",
    gender: "MALE",
    termsConsent: "DECLINE",
    officialId: {
      url: "https://example.com/id.exe",
      mimeType: "application/octet-stream",
      originalName: "id.exe",
      sizeBytes: 1000,
    },
  })

  assert.equal(invalid.success, false)
})

test("bookingRequestInitiateSchema rejects datetime strings for booking day fields", () => {
  const invalid = bookingRequestInitiateSchema.safeParse({
    fullName: "John Doe",
    phoneNumber: "+2348012345678",
    email: "john@example.com",
    arrivalDate: "2026-03-02T00:00:00.000Z",
    departureDate: "2026-03-05T00:00:00.000Z",
    roomTypeId: "roomType123",
    roomSpecification: "One Bedroom Apartment",
    heardAboutUs: "Instagram",
    guestType: "NEW",
    gender: "MALE",
    termsConsent: "ACCEPT",
    officialId: {
      url: "https://res.cloudinary.com/demo/image/upload/v1/file.jpg",
      mimeType: "image/jpeg",
      originalName: "id.jpg",
      sizeBytes: 1000,
    },
  })

  assert.equal(invalid.success, false)
})
