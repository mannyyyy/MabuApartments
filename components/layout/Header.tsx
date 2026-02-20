"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
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
  const isTransparentHeader = isAtTop && !isMobileMenuOpen
  const mainHeaderLogoSrc = isTransparentHeader ? "/images/mabu-logo-white.PNG" : "/images/mabu-logo.PNG"

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
          style={{ backgroundColor: isTransparentHeader ? "transparent" : "#faf9f6" }}
        >
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center" aria-label="Mabu Apartments home">
              <Image
                src={mainHeaderLogoSrc}
                alt="Mabu Apartments logo"
                width={116}
                height={116}
                className="h-[116px] w-[116px] object-contain"
                priority
              />
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
