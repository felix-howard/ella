/**
 * Sidebar component for Ella Workspace
 * Collapsible navigation with Ella mint green design
 */
import { Link, useRouterState } from '@tanstack/react-router'
import {
  LayoutDashboard,
  CheckSquare,
  Users,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
  LogOut,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { useUIStore } from '../../stores/ui-store'
import { UI_TEXT, NAV_ITEMS } from '../../lib/constants'

// Navigation items with icons mapped from constants
const navItemsWithIcons = [
  { path: '/', label: NAV_ITEMS[0].label, icon: LayoutDashboard },
  { path: '/actions', label: NAV_ITEMS[1].label, icon: CheckSquare },
  { path: '/clients', label: NAV_ITEMS[2].label, icon: Users },
  { path: '/messages', label: NAV_ITEMS[3].label, icon: MessageSquare },
] as const

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const routerState = useRouterState()
  const currentPath = routerState.location.pathname

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {!sidebarCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
            <span className="font-semibold text-xl text-primary">Ella</span>
          </Link>
        )}
        {sidebarCollapsed && (
          <Link to="/" className="w-full flex justify-center">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-lg">E</span>
            </div>
          </Link>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {navItemsWithIcons.map((item) => {
          const isActive = item.path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(item.path)
          const Icon = item.icon

          return (
            <Link
              key={item.path}
              to={item.path as '/'}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border p-3 space-y-2">
        {/* User info */}
        <div
          className={cn(
            'flex items-center gap-3 px-3 py-2',
            sidebarCollapsed && 'justify-center'
          )}
        >
          <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
            <span className="text-white text-sm font-medium">NV</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{UI_TEXT.staff.defaultName}</p>
              <p className="text-xs text-muted-foreground truncate">{UI_TEXT.staff.defaultEmail}</p>
            </div>
          )}
        </div>

        {/* Logout button */}
        <button
          className={cn(
            'flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={UI_TEXT.logout}
          title={UI_TEXT.logout}
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          {!sidebarCollapsed && <span>{UI_TEXT.logout}</span>}
        </button>
      </div>

      {/* Collapse Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-3 top-20 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-muted transition-colors"
        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </aside>
  )
}
