import type { Metadata } from "next"
import { HeroSection } from "@/components/HeroSection"
import { GetToKnowUs } from "@/components/GetToKnowUs"
import { LocationSection } from "@/components/LocationSection"
import { MainFacilities } from "@/components/MainFacilities"
import { FAQ } from "@/components/faq"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "About",
  description: "Learn about Mabu Apartments, our facilities, and location in Abuja.",
}

export default function AboutPage() {
  return (
    <div className="bg-[#faf9f6]">
      <HeroSection />
      <div className="container mx-auto px-4 py-16 md:px-10">
        <GetToKnowUs />
        <div>
          <LocationSection />
        </div>
        <MainFacilities />
        <FAQ />
      </div>
    </div>
  )
}
