import type { Metadata } from "next"
import BakeryPageClient from "@/components/bakery/BakeryPageClient"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Bakery",
  description: "Explore Rayuwa Bakery at Mabu Apartments for fresh pastries and juices in Abuja.",
}

export default function BakeryPage() {
  return <BakeryPageClient />
}
