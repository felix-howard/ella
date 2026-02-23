/**
 * Sidebar component for Ella Workspace
 * Desktop: fixed collapsible sidebar
 * Mobile: slide-in drawer overlay with backdrop
 */
import { useRouterState, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useClerk, useUser, useOrganization } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useCallback } from 'react'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@ella/ui'
import { useUIStore, useMobileMenu } from '../../stores/ui-store'
import { api } from '../../lib/api-client'
import { useVoiceCallContext } from '../voice/voice-call-provider'
import { useOrgRole } from '../../hooks/use-org-role'
import { useIsMobile } from '../../hooks'
import { SidebarContent } from './sidebar-content'

// Navigation items
const BASE_NAV_ITEMS = [
  { path: '/', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/clients', i18nKey: 'nav.clients', icon: Users },
  { path: '/messages', i18nKey: 'nav.messages', icon: MessageSquare },
] as const

const TEAM_NAV_ITEM = { path: '/team', i18nKey: 'nav.team', icon: UsersRound } as const
const SETTINGS_NAV_ITEM = { path: '/settings', i18nKey: 'nav.settings', icon: Settings } as const

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { open: mobileMenuOpen, setOpen: setMobileMenuOpen } = useMobileMenu()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const currentPath = routerState.location.pathname
  const { signOut } = useClerk()
  const { user } = useUser()
  const { state: voiceState } = useVoiceCallContext()
  const { isAdmin, avatarUrl } = useOrgRole()
  const { organization } = useOrganization()
  const isMobile = useIsMobile()

  // Auto-close drawer on route change (mobile only)
  const prevPathRef = useRef(currentPath)
  useEffect(() => {
    if (prevPathRef.current !== currentPath) {
      prevPathRef.current = currentPath
      if (isMobile && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
  }, [currentPath, isMobile, mobileMenuOpen, setMobileMenuOpen])

  // Keyboard: close drawer on Escape
  useEffect(() => {
    if (!isMobile || !mobileMenuOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isMobile, mobileMenuOpen, setMobileMenuOpen])

  // Focus trap: focus drawer when opened, return focus on close
  const triggerRef = useRef<Element | null>(null)
  const drawerRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (!isMobile) return
    if (mobileMenuOpen) {
      triggerRef.current = document.activeElement
      // Focus first focusable element in drawer
      setTimeout(() => {
        const focusable = drawerRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        )
        focusable?.focus()
      }, 100)
    } else if (triggerRef.current instanceof HTMLElement) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [isMobile, mobileMenuOpen])

  const handleClose = useCallback(() => setMobileMenuOpen(false), [setMobileMenuOpen])

  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? [TEAM_NAV_ITEM] : []),
    SETTINGS_NAV_ITEM,
  ]

  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.emailAddresses?.[0]?.emailAddress?.substring(0, 2).toUpperCase() || 'NV'
  const userName = user?.fullName || user?.firstName || t('staff.defaultName')

  const handleLogout = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const response = await api.messages.listConversations({ limit: 1 })
      return response.totalUnread || 0
    },
    refetchInterval: 30000,
    staleTime: 10000,
  })
  const unreadCount = unreadData || 0

  const showLabels = isMobile || !sidebarCollapsed
  const isCollapsedDesktop = !isMobile && sidebarCollapsed

  const contentProps = {
    isMobile,
    showLabels,
    isCollapsedDesktop,
    navItems: navItems as { path: string; i18nKey: string; icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[],
    currentPath,
    unreadCount,
    userInitials,
    userName,
    organizationName: organization?.name,
    avatarUrl,
    voiceState,
    onClose: handleClose,
    onLogout: handleLogout,
  }

  // Mobile: drawer overlay
  if (isMobile) {
    return (
      <>
        {/* Backdrop with fade transition */}
        <div
          className={cn(
            'fixed inset-0 z-50 bg-black/50 transition-opacity duration-300',
            mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          onClick={handleClose}
          aria-hidden="true"
        />
        {/* Drawer with slide + focus trap */}
        <aside
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className={cn(
            'fixed left-0 top-0 z-50 h-screen w-60 bg-card border-r border-border flex flex-col transition-transform duration-300 ease-in-out motion-reduce:transition-none',
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          )}
        >
          <SidebarContent {...contentProps} />
        </aside>
      </>
    )
  }

  // Desktop: fixed sidebar with collapse toggle
  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 motion-reduce:transition-none flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      <SidebarContent {...contentProps} />

      {/* Collapse Toggle Button (desktop only) */}
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
