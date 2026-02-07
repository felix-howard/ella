/**
 * Header component for Ella Workspace
 * Desktop: hidden (no top header needed, sidebar handles navigation)
 * Mobile: fixed top bar with hamburger menu, logo, unread badge
 */
import { Menu } from 'lucide-react'
import { EllaArrow } from '@ella/ui'
import { useMobileMenu } from '../../stores/ui-store'
import { useIsMobile } from '../../hooks'

export function Header() {
  const { toggle } = useMobileMenu()
  const isMobile = useIsMobile()

  // Desktop: no header needed
  if (!isMobile) return null

  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-card border-b border-border flex items-center justify-between px-4">
      <button
        onClick={toggle}
        className="p-2.5 -ml-2 rounded-lg hover:bg-muted transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Open menu"
      >
        <Menu className="w-5 h-5 text-foreground" />
      </button>

      <img src={EllaArrow} alt="Ella" className="h-6" />

      {/* Spacer for symmetry */}
      <div className="w-9" />
    </header>
  )
}
