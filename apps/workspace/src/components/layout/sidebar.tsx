/**
 * Sidebar component for Ella Workspace
 * Collapsible navigation with Ella mint green design
 */
import { Link, useRouterState, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useClerk, useUser, useOrganization } from '@clerk/clerk-react'
import { useTranslation } from 'react-i18next'
import {
  LayoutDashboard,
  Users,
  UsersRound,
  MessageSquare,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Phone,
  PhoneOff,
  Loader2,
} from 'lucide-react'
import { cn, EllaLogoDark, EllaLogoLight, EllaArrow } from '@ella/ui'
import { useUIStore, useTheme } from '../../stores/ui-store'
import { api } from '../../lib/api-client'
import { useVoiceCallContext } from '../voice/voice-call-provider'
import { useOrgRole } from '../../hooks/use-org-role'

// Base navigation items with icons and i18n keys
const BASE_NAV_ITEMS = [
  { path: '/', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/clients', i18nKey: 'nav.clients', icon: Users },
  { path: '/messages', i18nKey: 'nav.messages', icon: MessageSquare },
] as const

// Admin-only nav item
const TEAM_NAV_ITEM = { path: '/team', i18nKey: 'nav.team', icon: UsersRound } as const
const SETTINGS_NAV_ITEM = { path: '/settings', i18nKey: 'nav.settings', icon: Settings } as const

export function Sidebar() {
  const { t } = useTranslation()
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
  const { theme } = useTheme()
  const routerState = useRouterState()
  const navigate = useNavigate()
  const currentPath = routerState.location.pathname
  const { signOut } = useClerk()
  const { user } = useUser()
  const { state: voiceState, actions: voiceActions } = useVoiceCallContext()
  const { isAdmin } = useOrgRole()
  const { organization } = useOrganization()

  // Build nav items - include Team for admins
  const navItems = [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? [TEAM_NAV_ITEM] : []),
    SETTINGS_NAV_ITEM,
  ]

  // Select logo based on theme
  const logo = theme === 'dark' ? EllaLogoDark : EllaLogoLight

  // Get user initials from Clerk user data
  const userInitials = user?.firstName && user?.lastName
    ? `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
    : user?.emailAddresses?.[0]?.emailAddress?.substring(0, 2).toUpperCase() || 'NV'

  const userName = user?.fullName || user?.firstName || t('staff.defaultName')
  const userEmail = user?.emailAddresses?.[0]?.emailAddress || t('staff.defaultEmail')

  // Handle logout
  const handleLogout = async () => {
    await signOut()
    navigate({ to: '/login' })
  }

  // Fetch total unread count for messages badge
  const { data: unreadData } = useQuery({
    queryKey: ['unread-count'],
    queryFn: async () => {
      const response = await api.messages.listConversations({ limit: 1 })
      return response.totalUnread || 0
    },
    refetchInterval: 30000, // Poll every 30 seconds
    staleTime: 10000,
  })

  const unreadCount = unreadData || 0

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 h-screen bg-card border-r border-border transition-all duration-300 flex flex-col',
        sidebarCollapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-center px-4 border-b border-border">
        {!sidebarCollapsed && (
          <Link to="/">
            <img src={logo} alt="ella.tax" className="h-8 object-contain" />
          </Link>
        )}
        {sidebarCollapsed && (
          <Link to="/">
            <img src={EllaArrow} alt="Ella" className="w-8 h-8 object-contain" />
          </Link>
        )}
      </div>

      {/* Organization name */}
      {!sidebarCollapsed && organization && (
        <div className="px-4 py-1 border-b border-border">
          <p className="text-xs text-muted-foreground truncate">{organization.name}</p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = item.path === '/'
            ? currentPath === '/'
            : currentPath.startsWith(item.path)
          const Icon = item.icon
          const isMessages = item.path === '/messages'
          const showBadge = isMessages && unreadCount > 0

          return (
            <Link
              key={item.path}
              to={item.path as '/'}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 relative',
                isActive
                  ? 'bg-primary-light text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" strokeWidth={isActive ? 2.5 : 2} />
              {!sidebarCollapsed && <span className="truncate">{t(item.i18nKey)}</span>}

              {/* Unread badge for messages */}
              {showBadge && (
                <span
                  className={cn(
                    'bg-destructive text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center',
                    sidebarCollapsed
                      ? 'absolute top-0.5 right-0.5 px-1'
                      : 'ml-auto px-1.5'
                  )}
                  aria-label={t('sidebar.unreadMessages', { count: unreadCount })}
                >
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
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
            <span className="text-white text-sm font-medium">{userInitials}</span>
          </div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
          )}
        </div>

        {/* Voice status indicator (auto-registered on page load) */}
        {voiceState.isAvailable && (
          <div
            className={cn(
              'relative flex items-center gap-3 px-3 py-2 w-full rounded-lg',
              sidebarCollapsed && 'justify-center',
              voiceState.isRegistered
                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                : voiceState.isRegistering
                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                  : 'text-muted-foreground'
            )}
            aria-label={voiceState.isRegistered ? t('sidebar.voiceReady') : t('sidebar.voiceConnecting')}
            title={voiceState.isRegistered ? t('sidebar.voiceReadyFull') : t('sidebar.voiceConnectingFull')}
          >
            {voiceState.isRegistering ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : voiceState.isRegistered ? (
              <Phone className="w-5 h-5" aria-hidden="true" />
            ) : (
              <PhoneOff className="w-5 h-5" aria-hidden="true" />
            )}
            {!sidebarCollapsed && (
              <span className="text-sm">
                {voiceState.isRegistering
                  ? t('sidebar.voiceConnecting')
                  : voiceState.isRegistered
                    ? t('sidebar.voiceReady')
                    : t('sidebar.voiceWaiting')}
              </span>
            )}
            {/* Online indicator dot */}
            {voiceState.isRegistered && sidebarCollapsed && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>
        )}

        {/* Logout button */}
        <button
          onClick={handleLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            sidebarCollapsed && 'justify-center'
          )}
          aria-label={t('common.logout')}
          title={t('common.logout')}
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          {!sidebarCollapsed && <span>{t('common.logout')}</span>}
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
