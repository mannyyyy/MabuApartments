import type { Metadata } from "next"
import HomePageClient from "@/components/home/HomePageClient"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Home",
  description: "Stay at Mabu Apartments in Abuja with premium comfort, modern rooms, and seamless booking.",
}

export default function HomePage() {
  return <HomePageClient />
}
