import type { Metadata } from "next"
import { MapPin } from "lucide-react"
import { ContactHero } from "@/components/ContactHero"
import { ContactInfo } from "@/components/contact-info"
import { ContactFormClient } from "@/components/contact/ContactFormClient"

export const dynamic = "force-static"

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Mabu Apartments for booking support, directions, and inquiries.",
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <ContactHero />

      <div className="container mx-auto px-4 py-16 bg-[#faf9f6]">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-serif mb-8">Get in Touch</h2>
              <ContactFormClient />
            </div>

            <div className="lg:col-span-1">
              <ContactInfo />
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-[600px] w-full mt-16">
        <iframe
          title="Map to Mabu Apartments"
          src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3940.0730918829946!2d7.449722115427616!3d9.072901193488901!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x104e0ba1305b2a6d%3A0x1c5ea49d6d3f0f5b!2sMabu%20Apartments!5e0!3m2!1sen!2sng!4v1651234567890!5m2!1sen!2sng"
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen={true}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full"
        ></iframe>
        <a
          href="https://maps.app.goo.gl/EMtMGABHBM22Mdsa7"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-10 transition-all duration-300"
          aria-label="Open directions to Mabu Apartments in Google Maps"
        >
          <div className="bg-white p-4 rounded-full shadow-lg">
            <MapPin className="w-8 h-8 text-[#D4B254]" />
          </div>
        </a>
      </div>
    </div>
  )
}
