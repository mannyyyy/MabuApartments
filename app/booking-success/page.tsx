import type { Metadata } from 'next'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Booking Success",
  description: "Your booking at Mabu Apartments was completed successfully.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function BookingSuccessPage() {
  return (
    <section aria-labelledby="booking-success-title" className="container mx-auto px-4 py-8 pt-24 text-center">
      <h1 id="booking-success-title" className="text-4xl font-bold mb-4">Booking Successful!</h1>
      <p className="text-xl mb-8">Thank you for choosing Mabu Apartments. We look forward to hosting you.</p>
      <p className="mb-8">A confirmation email has been sent to your provided email address with all the details of your booking.</p>
      <Button asChild>
        <Link href="/">Return to Home</Link>
      </Button>
    </section>
  )
}
