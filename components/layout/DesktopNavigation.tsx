import { Menu, X } from "lucide-react"

type DesktopNavigationProps = {
  isAtTop: boolean
  isMobileMenuOpen: boolean
  onToggleMobileMenu: () => void
}

export function DesktopNavigation({
  isAtTop,
  isMobileMenuOpen,
  onToggleMobileMenu,
}: DesktopNavigationProps) {
  return (
    <div className="flex items-center space-x-4">
      <button
        onClick={onToggleMobileMenu}
        className="p-2 transition-transform duration-200 hover:scale-105"
        aria-label="Toggle mobile menu"
      >
        {isMobileMenuOpen ? (
          <X className="h-6 w-6 text-gray-600" />
        ) : (
          <Menu className={`h-6 w-6 ${isAtTop ? "text-white" : "text-primary"}`} />
        )}
      </button>
    </div>
  )
}

