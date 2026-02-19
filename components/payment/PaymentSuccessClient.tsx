"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { CheckCircle, Clock3, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type VerifyResponse = {
  status: "success" | "error"
  reference?: string
  bookingConfirmed?: boolean
  message?: string
}

export function PaymentSuccessClient() {
  const [status, setStatus] = useState<"confirmed" | "processing" | "failure" | "loading">("loading")
  const [reference, setReference] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("reference")
    setReference(ref)

    if (!ref) {
      setStatus("failure")
      return
    }

    fetch(`/api/verify-payment?reference=${encodeURIComponent(ref)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`)
        }
        return res.json() as Promise<VerifyResponse>
      })
      .then((data) => {
        if (data.status !== "success") {
          throw new Error(data.message || "Payment verification failed")
        }
        setStatus(data.bookingConfirmed ? "confirmed" : "processing")
      })
      .catch((error) => {
        console.error("Error in payment verification:", error)
        setStatus("failure")
      })
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center max-w-xl px-4">
        {status === "confirmed" ? (
          <>
            <CheckCircle className="mx-auto h-16 w-16 text-green-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Booking Confirmed!</h1>
            <p className="text-gray-600 mb-4">
              Thank you for your payment. Your booking has been successfully confirmed.
            </p>
            {reference && <p className="text-sm text-gray-500 mb-4">Reference: {reference}</p>}
            <Button onClick={() => router.push("/")}>Return to Home</Button>
          </>
        ) : status === "processing" ? (
          <>
            <Clock3 className="mx-auto h-16 w-16 text-amber-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment Received</h1>
            <p className="text-gray-600 mb-4">
              Your payment was received. We are finalizing your booking and you will get confirmation shortly.
            </p>
            {reference && <p className="text-sm text-gray-500 mb-4">Reference: {reference}</p>}
            <Button onClick={() => router.push("/")}>Return to Home</Button>
          </>
        ) : status === "failure" ? (
          <>
            <XCircle className="mx-auto h-16 w-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Booking Failed</h1>
            <p className="text-gray-600 mb-4">We could not process your booking. Please contact support or try again.</p>
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
            <p className="text-gray-600 mb-4">Verifying your payment...</p>
            {reference && <p className="text-sm text-gray-500">Reference: {reference}</p>}
          </>
        )}
      </div>
    </div>
  )
}
