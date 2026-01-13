/**
 * Page Container component
 * Provides consistent page layout with proper spacing
 */
import { cn } from '@ella/ui'
import { useUIStore } from '../../stores/ui-store'

interface PageContainerProps {
  children: React.ReactNode
  className?: string
}

export function PageContainer({ children, className }: PageContainerProps) {
  const { sidebarCollapsed } = useUIStore()

  return (
    <main
      className={cn(
        'min-h-screen pt-16 pb-6 px-6 transition-all duration-300',
        sidebarCollapsed ? 'ml-16' : 'ml-60',
        className
      )}
    >
      <div className="max-w-7xl mx-auto py-6">{children}</div>
    </main>
  )
}
