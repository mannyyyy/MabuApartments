"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createBookingAction } from "@/app/actions/bookings"

export function PaymentSuccessClient() {
  const [status, setStatus] = useState<"success" | "failure" | "loading">("loading")
  const [reference, setReference] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("reference")
    setReference(ref)

    console.log("Payment success page loaded. Reference:", ref)

    if (!ref) {
      console.error("No reference found in query parameters")
      setStatus("failure")
      return
    }

    console.log("Verifying payment with reference:", ref)

    fetch(`/api/verify-payment?reference=${ref}`)
      .then((res) => {
        console.log("Verify payment response status:", res.status)
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        console.log("Full verification response:", data)

        if (data.status === "success" && data.reference === ref) {
          return createBookingAction({
            roomId: data.metadata.roomId,
            guestName: data.metadata.name,
            guestEmail: data.customer.email,
            checkIn: data.metadata.checkIn,
            checkOut: data.metadata.checkOut,
            totalPrice: data.amount / 100,
            paymentReference: data.reference,
          })
        }
        throw new Error("Payment verification failed")
      })
      .then((bookingData) => {
        console.log("Booking created:", bookingData)
        setStatus("success")
      })
      .catch((error) => {
        console.error("Error in payment process:", error)
        setStatus("failure")
      })
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        {status === "success" ? (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-4">
              Thank you for your payment. Your booking has been successfully created.
              <br />
              <span className="text-sm">
                A confirmation email will be sent to your email address shortly. If you don&apos;t receive it, please
                check your spam folder or contact support.
              </span>
            </p>
            <p className="text-sm text-gray-500 mb-4">Reference: {reference}</p>
            <Button onClick={() => router.push("/")}>Return to Home</Button>
          </>
        ) : status === "failure" ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Booking Failed</h1>
            <p className="text-gray-600 mb-4">
              We could not process your booking. Please contact support or try again.
            </p>
            {reference && <p className="text-sm text-gray-500 mb-4">Reference: {reference}</p>}
            <Button onClick={() => router.push("/")}>Return to Home</Button>
          </>
        ) : (
          <>
            <div className="animate-pulse">
              <div className="h-16 w-16 rounded-full bg-gray-200 mx-auto mb-4" />
              <div className="h-6 w-32 bg-gray-200 mx-auto mb-2 rounded" />
              <div className="h-4 w-64 bg-gray-200 mx-auto mb-4 rounded" />
            </div>
            <p className="text-gray-600 mb-4">Processing your booking...</p>
            {reference && <p className="text-sm text-gray-500">Reference: {reference}</p>}
          </>
        )}
      </div>
    </div>
  )
}
