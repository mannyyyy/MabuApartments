"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertTriangle, CheckCircle, Clock3, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

type VerifyResponse = {
  status: "success" | "error"
  verificationState?: "confirmed" | "processing" | "needs_review" | "failed" | "unknown"
  reviewReason?: string | null
  bookingConfirmed?: boolean
  message?: string
}

const POLL_INTERVAL_MS = 3000
const MAX_POLL_ATTEMPTS = 20

export function PaymentSuccessClient() {
  const [status, setStatus] = useState<
    "confirmed" | "processing" | "needs_review" | "failure" | "loading"
  >("loading")
  const [reference, setReference] = useState<string | null>(null)
  const [reviewReason, setReviewReason] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("reference")
    setReference(ref)
    setReviewReason(null)

    if (!ref) {
      setStatus("failure")
      return
    }

    let cancelled = false

    const pollVerification = async (attempt = 1): Promise<void> => {
      if (cancelled) {
        return
      }

      try {
        const res = await fetch(`/api/verify-payment?reference=${encodeURIComponent(ref)}`, {
          cache: "no-store",
        })
        if (!res.ok) {
          throw new Error(`API returned status ${res.status}`)
        }

        const data = (await res.json()) as VerifyResponse
        if (data.status !== "success") {
          throw new Error(data.message || "Payment verification failed")
        }

        const verificationState = data.verificationState ?? "unknown"
        if (verificationState === "confirmed" || data.bookingConfirmed) {
          setStatus("confirmed")
          return
        }

        if (verificationState === "needs_review") {
          setReviewReason(data.reviewReason ?? null)
          setStatus("needs_review")
          return
        }

        if (verificationState === "failed") {
          setStatus("failure")
          return
        }

        setStatus("processing")

        if (attempt < MAX_POLL_ATTEMPTS) {
          window.setTimeout(() => {
            void pollVerification(attempt + 1)
          }, POLL_INTERVAL_MS)
        }
      } catch (error) {
        console.error("Error in payment verification:", error)
        if (attempt < 3) {
          window.setTimeout(() => {
            void pollVerification(attempt + 1)
          }, POLL_INTERVAL_MS)
          return
        }
        setStatus("failure")
      }
    }

    void pollVerification()
    return () => {
      cancelled = true
    }
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
        ) : status === "needs_review" ? (
          <>
            <AlertTriangle className="mx-auto h-16 w-16 text-amber-600 mb-4" />
            <h1 className="text-2xl font-bold mb-2">Payment Received, Manual Review Required</h1>
            <p className="text-gray-600 mb-4">
              Your payment has been received, but we need to manually confirm your booking details.
            </p>
            {reviewReason && (
              <p className="text-sm text-gray-500 mb-4 break-words">Reason: {reviewReason}</p>
            )}
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
