/**
 * Sidebar content (navigation, user info, voice status, logout)
 * Shared between desktop sidebar and mobile drawer
 */
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  LogOut,
  Phone,
  PhoneOff,
  Loader2,
  X,
} from 'lucide-react'
import { cn, EllaLogoDark, EllaLogoLight, EllaArrow } from '@ella/ui'
import { useTheme } from '../../stores/ui-store'

const BADGE_MAX_COUNT = 99

interface NavItem {
  path: string
  i18nKey: string
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>
}

interface SidebarContentProps {
  isMobile: boolean
  showLabels: boolean
  isCollapsedDesktop: boolean
  navItems: NavItem[]
  currentPath: string
  unreadCount: number
  userInitials: string
  userName: string
  organizationName?: string
  avatarUrl?: string | null
  voiceState: {
    isAvailable: boolean
    isRegistered: boolean
    isRegistering: boolean
  }
  onClose: () => void
  onLogout: () => void
}

export function SidebarContent({
  isMobile,
  showLabels,
  isCollapsedDesktop,
  navItems,
  currentPath,
  unreadCount,
  userInitials,
  userName,
  organizationName,
  avatarUrl,
  voiceState,
  onClose,
  onLogout,
}: SidebarContentProps) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const logo = theme === 'dark' ? EllaLogoDark : EllaLogoLight

  return (
    <>
      {/* Logo Section */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-border">
        {showLabels ? (
          <Link to="/">
            <img src={logo} alt="ella.tax" className="h-8 object-contain" />
          </Link>
        ) : (
          <Link to="/" className="mx-auto">
            <img src={EllaArrow} alt="Ella" className="w-8 h-8 object-contain" />
          </Link>
        )}
        {isMobile && (
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-muted transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" role="navigation" aria-label="Main navigation">
        {navItems.map((item) => {
          const isActive = item.path === '/' ? currentPath === '/' : currentPath.startsWith(item.path)
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
              {showLabels && <span className="truncate">{t(item.i18nKey)}</span>}
              {showBadge && (
                <span
                  className={cn(
                    'bg-destructive text-white text-xs font-medium rounded-full min-w-[18px] h-[18px] flex items-center justify-center',
                    isCollapsedDesktop ? 'absolute top-0.5 right-0.5 px-1' : 'ml-auto px-1.5'
                  )}
                  aria-label={t('sidebar.unreadMessages', { count: unreadCount })}
                >
                  {unreadCount > BADGE_MAX_COUNT ? `${BADGE_MAX_COUNT}+` : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-border p-3 space-y-2">
        <Link
          to="/team/profile/$staffId"
          params={{ staffId: 'me' }}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            'hover:bg-muted cursor-pointer',
            isCollapsedDesktop && 'justify-center'
          )}
          title={t('profile.viewProfile')}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={userName}
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center">
              <span className="text-white text-sm font-medium">{userInitials}</span>
            </div>
          )}
          {showLabels && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{userName}</p>
              {organizationName && (
                <p className="text-xs text-primary truncate">{organizationName}</p>
              )}
            </div>
          )}
        </Link>

        {/* Voice status */}
        {voiceState.isAvailable && (
          <div
            className={cn(
              'relative flex items-center gap-3 px-3 py-2 w-full rounded-lg',
              isCollapsedDesktop && 'justify-center',
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
            {showLabels && (
              <span className="text-sm">
                {voiceState.isRegistering
                  ? t('sidebar.voiceConnecting')
                  : voiceState.isRegistered
                    ? t('sidebar.voiceReady')
                    : t('sidebar.voiceWaiting')}
              </span>
            )}
            {voiceState.isRegistered && isCollapsedDesktop && (
              <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            )}
          </div>
        )}

        {/* Logout */}
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
            isCollapsedDesktop && 'justify-center'
          )}
          aria-label={t('common.logout')}
          title={t('common.logout')}
        >
          <LogOut className="w-5 h-5" aria-hidden="true" />
          {showLabels && <span>{t('common.logout')}</span>}
        </button>
      </div>
    </>
  )
}
