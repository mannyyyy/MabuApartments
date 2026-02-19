import { Suspense } from "react"
import { PaymentSuccessClient } from "@/components/payment/PaymentSuccessClient"

export const dynamic = "force-dynamic"

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <PaymentSuccessClient />
    </Suspense>
  )
}
