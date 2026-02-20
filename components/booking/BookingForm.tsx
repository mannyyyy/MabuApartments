"use client"

import { useCallback, useState } from "react"
import { isAfter, isBefore, isSameDay } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useAvailability } from "@/hooks/useAvailability"
import { useBookingPrice } from "@/hooks/useBookingPrice"
import { useToast } from "@/hooks/use-toast"
import { bookingFormSchema, type BookingDateRange, type BookingFormValues } from "@/lib/validators/booking.schema"
import { DateRangePicker } from "@/components/booking/DateRangePicker"
import { PriceSummary } from "@/components/booking/PriceSummary"
import { checkAvailabilityAction } from "@/app/actions/availability"

type BookingFormProps = {
  roomTypeId: string
  price: number
  title: string
}

type UploadedOfficialId = {
  url: string
  mimeType: string
  originalName: string
  sizeBytes: number
}

function toUtcNoonISOString(date: Date) {
  // Normalize day-only selections to noon UTC to avoid timezone rollbacks to the previous day.
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0)).toISOString()
}

export function BookingForm({ roomTypeId, price, title }: BookingFormProps) {
  const [dateRange, setDateRange] = useState<BookingDateRange>({
    from: undefined,
    to: undefined,
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [officialIdFile, setOfficialIdFile] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { unavailableDates } = useAvailability(roomTypeId)
  const { totalPrice, nights } = useBookingPrice(price, dateRange)
  const { toast } = useToast()

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      fullName: "",
      phoneNumber: "",
      email: "",
      roomSpecification: title,
      heardAboutUs: "",
      guestType: "NEW",
      gender: "PREFER_NOT_TO_SAY",
      termsConsent: "DECLINE",
      dateRange: {
        from: undefined,
        to: undefined,
      },
    },
  })

  const handleDateSelect = useCallback(
    (range: BookingDateRange | undefined) => {
      if (!range) {
        setDateRange({ from: undefined, to: undefined })
        return
      }

      if (!range.from) {
        setDateRange({ from: undefined, to: undefined })
        return
      }

      if (range.from && !range.to) {
        setDateRange({ from: range.from, to: undefined })
        return
      }

      if (range.from && range.to) {
        const isRangeAvailable = !unavailableDates.some(
          (unavailableDate) =>
            (isAfter(unavailableDate, range.from!) || isSameDay(unavailableDate, range.from!)) &&
            (isBefore(unavailableDate, range.to!) || isSameDay(unavailableDate, range.to!)),
        )

        if (isRangeAvailable) {
          setDateRange({ from: range.from, to: range.to })
          setIsCalendarOpen(false)
        } else {
          toast({
            title: "Invalid Date Range",
            description: "Your selected date range includes unavailable dates. Please choose different dates.",
            variant: "destructive",
          })
          setDateRange({ from: range.from, to: undefined })
        }
      }
    },
    [unavailableDates, toast],
  )

  async function uploadOfficialId(file: File): Promise<UploadedOfficialId> {
    const tokenResponse = await fetch("/api/uploads/official-id/token", {
      method: "POST",
    })
    const tokenData = await tokenResponse.json()
    if (!tokenResponse.ok || !tokenData.token) {
      throw new Error(tokenData.message || "Could not start secure upload")
    }

    const filePayload = new FormData()
    filePayload.append("file", file)

    const response = await fetch("/api/uploads/official-id", {
      method: "POST",
      headers: {
        "x-upload-token": tokenData.token as string,
      },
      body: filePayload,
    })

    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.message || "Official ID upload failed")
    }

    return data as UploadedOfficialId
  }

  async function onSubmit(values: BookingFormValues) {
    try {
      setIsSubmitting(true)

      if (!values.dateRange.from || !values.dateRange.to) {
        toast({
          title: "Invalid Date Range",
          description: "Please select both check-in and check-out dates.",
          variant: "destructive",
        })
        return
      }

      if (!officialIdFile) {
        toast({
          title: "Official ID required",
          description: "Please upload a valid ID file (PDF or image, max 10MB).",
          variant: "destructive",
        })
        return
      }

      const arrivalDateIso = toUtcNoonISOString(values.dateRange.from)
      const departureDateIso = toUtcNoonISOString(values.dateRange.to)

      const availabilityData = await checkAvailabilityAction({
        roomTypeId,
        checkIn: arrivalDateIso,
        checkOut: departureDateIso,
      })

      if (!availabilityData.available) {
        toast({
          title: "Room Not Available",
          description: "Sorry, the room is not available for the selected dates. Please choose different dates.",
          variant: "destructive",
        })
        return
      }

      const uploadedOfficialId = await uploadOfficialId(officialIdFile)

      const paymentResponse = await fetch("/api/booking-requests/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: values.fullName,
          phoneNumber: values.phoneNumber,
          email: values.email,
          arrivalDate: arrivalDateIso,
          departureDate: departureDateIso,
          roomTypeId,
          roomSpecification: values.roomSpecification,
          heardAboutUs: values.heardAboutUs,
          guestType: values.guestType,
          gender: values.gender,
          termsConsent: values.termsConsent,
          officialId: uploadedOfficialId,
        }),
      })

      const paymentData = await paymentResponse.json()

      if (paymentResponse.ok && paymentData.authorization_url) {
        window.location.href = paymentData.authorization_url
        return
      }

      if (paymentResponse.status === 400 && paymentData?.errors?.fieldErrors) {
        const fieldErrors = paymentData.errors.fieldErrors as Record<string, string[] | undefined>
        const firstFieldMessage = Object.values(fieldErrors).flat().find(Boolean)
        throw new Error(firstFieldMessage || paymentData.message || "Invalid booking request payload")
      }

      if (paymentData.retryable) {
        toast({
          title: "Payment provider is temporarily unavailable",
          description: paymentData.message || "Please try again in a moment.",
          variant: "destructive",
        })
        return
      }

      throw new Error(paymentData.message || "Payment initialization failed")
    } catch (error) {
      console.error(error)
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "An error occurred during the booking process. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="w-full max-w-3xl mx-auto relative">
      <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Check Availability</h2>
              <p className="text-sm text-gray-500">Book your stay at {title}</p>
            </div>

            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input placeholder="+2348012345678" type="tel" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input placeholder="john@example.com" type="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roomSpecification"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Room Specification</FormLabel>
                  <FormControl>
                    <Input {...field} readOnly />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DateRangePicker
              control={form.control}
              dateRange={dateRange}
              isCalendarOpen={isCalendarOpen}
              unavailableDates={unavailableDates}
              onCalendarOpenChange={setIsCalendarOpen}
              onDateSelect={handleDateSelect}
            />

            <FormField
              control={form.control}
              name="heardAboutUs"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Where did you hear about us?</FormLabel>
                  <FormControl>
                    <Input placeholder="Instagram, referral, Google..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="guestType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Guest Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select guest type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="NEW">New Guest</SelectItem>
                      <SelectItem value="RETURNING">Returning Guest</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gender"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gender</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="MALE">Male</SelectItem>
                      <SelectItem value="FEMALE">Female</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                      <SelectItem value="PREFER_NOT_TO_SAY">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-2">
              <label className="text-sm font-medium leading-none">Official ID (PDF/Image, max 10MB)</label>
              <Input
                type="file"
                accept=".pdf,image/jpeg,image/png,image/webp"
                onChange={(event) => {
                  const file = event.target.files?.[0] || null
                  if (file && file.size > 10 * 1024 * 1024) {
                    toast({
                      title: "File too large",
                      description: "Official ID must be 10MB or less.",
                      variant: "destructive",
                    })
                    event.target.value = ""
                    setOfficialIdFile(null)
                    return
                  }
                  setOfficialIdFile(file)
                }}
              />
              {!officialIdFile ? (
                <p className="text-[0.8rem] text-muted-foreground">Upload one official ID file before payment.</p>
              ) : (
                <p className="text-[0.8rem] text-muted-foreground">Selected: {officialIdFile.name}</p>
              )}
            </div>

            <FormField
              control={form.control}
              name="termsConsent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Terms &amp; Conditions</FormLabel>
                  <div className="rounded-md border p-3 text-sm space-y-2">
                    <ol className="list-decimal pl-5 space-y-1">
                      <li>Suicide is strictly prohibited on the premises.</li>
                      <li>
                        A refundable deposit of NGN 20,000 is required at check-in and is refunded in full if there
                        is no damage to room gadgets or property.
                      </li>
                      <li>Smoking is not allowed inside the apartment or anywhere on the premises.</li>
                      <li>
                        Extension and late checkout: NGN 20,000 extra per hour will be charged if you fail to check
                        out on time.
                      </li>
                    </ol>
                    <p className="text-xs text-muted-foreground">
                      By accepting these terms, you confirm that you have read, understood, and agree to abide by all
                      conditions listed.
                    </p>
                  </div>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Accept or decline" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="ACCEPT">Accept</SelectItem>
                      <SelectItem value="DECLINE">Decline</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <PriceSummary totalPrice={totalPrice} nights={nights} pricePerNight={price} />

            <Button
              type="submit"
              className="w-full bg-[#978667] hover:bg-[#4B514C] text-white font-semibold"
              size="lg"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Processing..." : "Proceed to Payment"}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
