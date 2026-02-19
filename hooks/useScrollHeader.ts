import { useEffect, useRef, useState } from "react"

export function useScrollHeader(isMobileMenuOpen: boolean) {
  const [isAtTop, setIsAtTop] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const lastScrollY = useRef(0)
  const headerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY
      const header = headerRef.current

      if (!header || isMobileMenuOpen) return

      const headerHeight = header.offsetHeight

      if (currentScrollY < lastScrollY.current || currentScrollY < headerHeight) {
        setIsVisible(true)
      } else if (currentScrollY > lastScrollY.current && currentScrollY > headerHeight) {
        setIsVisible(false)
      }

      lastScrollY.current = currentScrollY
      setIsAtTop(currentScrollY < 10)
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isMobileMenuOpen])

  return { headerRef, isAtTop, isVisible }
}

