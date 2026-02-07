/**
 * Page Container component
 * Provides consistent page layout with proper spacing
 * Mobile: full-width with top padding for mobile header
 * Desktop: left margin offset for sidebar
 */
import { cn } from '@ella/ui'
import { useUIStore } from '../../stores/ui-store'
import { useIsMobile } from '../../hooks'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  const { sidebarCollapsed } = useUIStore()
  const isMobile = useIsMobile()

  return (
    <main
      className={cn(
        'min-h-screen transition-all duration-300',
        isMobile
          ? 'pt-14 px-4 py-4'
          : cn('py-6 px-6', sidebarCollapsed ? 'ml-16' : 'ml-60'),
        className
      )}
    >
      <div className="max-w-7xl mx-auto">{children}</div>
    </main>
  )
}
