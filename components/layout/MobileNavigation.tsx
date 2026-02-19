import Link from "next/link"
import { Phone, X } from "lucide-react"
import { Button } from "@/components/ui/button"

type MobileNavigationProps = {
  isOpen: boolean
  onClose: () => void
}

const navigationLinks = [
  { href: "/", label: "HOME" },
  { href: "/rooms", label: "ROOMS & SUITES" },
  { href: "/about", label: "ABOUT US" },
  { href: "/bakery", label: "RAYUWA BAKERY" },
  { href: "/contact", label: "CONTACT" },
]

export function MobileNavigation({ isOpen, onClose }: MobileNavigationProps) {
  return (
    <>
      <div
        className={`fixed inset-0 bg-black/60 transition-opacity duration-300 ${
          isOpen ? "opacity-100 z-[60]" : "opacity-0 pointer-events-none z-0"
        }`}
        style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        onClick={onClose}
      />

      <div
        className={`fixed top-0 right-0 h-full w-[300px] flex flex-col transition-transform duration-300 transform z-[70] ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
        style={{ backgroundColor: "#faf9f6" }}
      >
        <div className="relative flex-shrink-0 px-6 py-6 border-b border-gray-200">
          <div className="flex items-center justify-center">
            <Link href="/" onClick={onClose} className="text-center">
              <span className="block text-2xl font-bold tracking-wide text-black">MABU</span>
              <span className="block text-xs font-light tracking-widest text-black">APARTMENTS</span>
            </Link>
          </div>
          <button
            className="absolute top-6 right-6 hover:scale-105 transition-transform duration-200"
            onClick={onClose}
            aria-label="Close mobile menu"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <nav className="flex-1 flex flex-col justify-start items-start px-6 pt-8 space-y-8">
          {navigationLinks.map((item) => (
            <Link key={item.href} href={item.href} className="text-base font-semibold text-gray-900" onClick={onClose}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-gray-200 mt-auto p-6 space-y-6">
          <div className="flex items-center space-x-4">
            <Phone className="text-[#8B7C56]" />
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase text-gray-500">For Information</span>
              <a href="tel:+2349075120963" className="text-base font-bold text-[#8B7C56]">
                +234 907 512 0963
              </a>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <Phone className="text-[#8B7C56]" />
            <div className="flex flex-col">
              <span className="text-xs font-medium uppercase text-gray-500">Or Call</span>
              <a href="tel:+2348163679671" className="text-base font-bold text-[#8B7C56]">
                +234 816 367 9671
              </a>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <Button className="w-full bg-[#978667] hover:bg-[#4B514C] text-white font-semibold" onClick={onClose}>
              <Link href="/rooms">Book Now</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}

