/**
 * Header component for Ella Workspace
 * Top bar with search, notifications, and quick actions
 */
import { Search, Bell, Plus } from 'lucide-react'
import { Button } from '@ella/ui'
import { useUIStore } from '../../stores/ui-store'
import { cn } from '@ella/ui'
import { Link } from '@tanstack/react-router'

interface HeaderProps {
  title?: string
  showSearch?: boolean
  actions?: React.ReactNode
}

export function Header({ title, showSearch = true, actions }: HeaderProps) {
  const { globalSearch, setGlobalSearch, sidebarCollapsed } = useUIStore()

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 h-16 bg-card/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6 transition-all duration-300',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Left: Title or Search */}
      <div className="flex items-center gap-4 flex-1">
        {title && (
          <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        )}

        {showSearch && (
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm..."
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {actions}

        {/* Notifications */}
        <button
          className="relative p-2 rounded-lg hover:bg-muted transition-colors"
          aria-label="Thông báo"
          title="Thông báo"
        >
          <Bell className="w-5 h-5 text-muted-foreground" aria-hidden="true" />
          {/* Notification badge */}
          <span className="absolute top-1 right-1 w-2 h-2 bg-accent rounded-full" aria-label="Có thông báo mới" />
        </button>

        {/* Quick add client */}
        <Link to="/">
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Thêm khách</span>
          </Button>
        </Link>
      </div>
    </header>
  )
}
