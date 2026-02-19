import type { Metadata } from "next"
import { Suspense } from "react"
import { PaymentSuccessClient } from "@/components/payment/PaymentSuccessClient"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Payment Status",
  description: "Payment verification and booking confirmation status for your Mabu Apartments reservation.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentSuccessClient />
    </Suspense>
  )
}
