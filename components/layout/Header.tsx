"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { DesktopNavigation } from "@/components/layout/DesktopNavigation"
import { MobileNavigation } from "@/components/layout/MobileNavigation"
import { useScrollHeader } from "@/hooks/useScrollHeader"

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { headerRef, isAtTop, isVisible } = useScrollHeader(isMobileMenuOpen)

  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = "auto"
    }

    return () => {
      document.body.style.overflow = "auto"
    }
  }, [isMobileMenuOpen])

  const headerBackgroundClass = isAtTop && !isMobileMenuOpen ? "bg-transparent" : "bg-background"

  return (
    <>
      <div
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-transform duration-300 ${
          isVisible || isMobileMenuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <header
          className={`${headerBackgroundClass} transition-colors duration-300`}
          style={{ backgroundColor: isAtTop && !isMobileMenuOpen ? "transparent" : "#faf9f6" }}
        >
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <span className={`text-2xl font-bold ${isAtTop && !isMobileMenuOpen ? "text-white" : "text-primary"}`}>
                MABU
              </span>
              <span className={`text-lg ${isAtTop && !isMobileMenuOpen ? "text-white" : "text-primary"}`}>
                Apartments
              </span>
            </Link>

            <DesktopNavigation
              isAtTop={isAtTop}
              isMobileMenuOpen={isMobileMenuOpen}
              onToggleMobileMenu={() => setIsMobileMenuOpen((prev) => !prev)}
            />
          </div>
        </header>
      </div>

      <MobileNavigation isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
    </>
  )
}

