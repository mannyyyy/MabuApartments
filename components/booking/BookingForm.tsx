"use client"

import { useCallback, useState } from "react"
import { isAfter, isBefore, isSameDay } from "date-fns"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
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

export function BookingForm({ roomTypeId, price, title }: BookingFormProps) {
  const [dateRange, setDateRange] = useState<BookingDateRange>({
    from: undefined,
    to: undefined,
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const { unavailableDates } = useAvailability(roomTypeId)
  const { totalPrice, nights } = useBookingPrice(price, dateRange)
  const { toast } = useToast()

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      name: "",
      email: "",
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

  async function onSubmit(values: BookingFormValues) {
    try {
      if (!values.dateRange.from || !values.dateRange.to) {
        toast({
          title: "Invalid Date Range",
          description: "Please select both check-in and check-out dates.",
          variant: "destructive",
        })
        return
      }

      const availabilityData = await checkAvailabilityAction({
        roomTypeId,
        checkIn: values.dateRange.from.toISOString(),
        checkOut: values.dateRange.to.toISOString(),
      })

      if (!availabilityData.available) {
        toast({
          title: "Room Not Available",
          description: "Sorry, the room is not available for the selected dates. Please choose different dates.",
          variant: "destructive",
        })
        return
      }

      const paymentResponse = await fetch("/api/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          amount: totalPrice * 100,
          metadata: {
            name: values.name,
            roomId: availabilityData.roomId,
            checkIn: values.dateRange.from.toISOString(),
            checkOut: values.dateRange.to.toISOString(),
            roomTitle: title,
          },
        }),
      })

      const paymentData = await paymentResponse.json()

      if (paymentResponse.ok) {
        window.location.href = paymentData.authorization_url
      } else {
        throw new Error(paymentData.message || "Payment initialization failed")
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred during the booking process. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleWhatsAppBooking = () => {
    const message = encodeURIComponent(`I would like to make a booking for ${title}`)
    const whatsappUrl = `https://wa.me/2348103992400?text=${message}`
    window.open(whatsappUrl, "_blank")
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John Doe" {...field} />
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

            <DateRangePicker
              control={form.control}
              dateRange={dateRange}
              isCalendarOpen={isCalendarOpen}
              unavailableDates={unavailableDates}
              onCalendarOpenChange={setIsCalendarOpen}
              onDateSelect={handleDateSelect}
            />

            <PriceSummary totalPrice={totalPrice} nights={nights} pricePerNight={price} />

            <Button
              type="button"
              className="w-full bg-[#978667] hover:bg-[#4B514C] text-white font-semibold"
              size="lg"
              onClick={handleWhatsAppBooking}
            >
              Book Now via WhatsApp
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}
