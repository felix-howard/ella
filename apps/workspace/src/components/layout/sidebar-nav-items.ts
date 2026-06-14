import {
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import type { NavItem } from './sidebar-content'

const BASE_NAV_ITEMS = [
  { path: '/', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/clients', i18nKey: 'nav.clients', icon: Users },
  { path: '/messages', i18nKey: 'nav.messages', icon: MessageSquare },
] as const satisfies readonly NavItem[]

// Visible to ADMIN + MANAGER (client/lead management tier)
const MANAGEMENT_NAV_ITEMS = [
  { path: '/leads', i18nKey: 'nav.leads', icon: Megaphone },
] as const satisfies readonly NavItem[]

// Visible to ADMIN only (payment links and payment history)
const PAYMENTS_NAV_ITEM = [
  { path: '/pricing-calculator', i18nKey: 'nav.pricingCalculator', icon: WalletCards },
] as const satisfies readonly NavItem[]

// Visible to all active org staff; management actions stay admin-gated in Team routes.
const TEAM_NAV_ITEM = {
  path: '/team',
  i18nKey: 'nav.team',
  icon: UsersRound,
} as const satisfies NavItem

const SETTINGS_NAV_ITEM = {
  path: '/settings',
  i18nKey: 'nav.settings',
  icon: Settings,
} as const satisfies NavItem

export function getSidebarNavItems(flags: {
  canManageClients: boolean
  canManagePayments: boolean
  canViewTeam: boolean
}): NavItem[] {
  return [
    ...BASE_NAV_ITEMS,
    ...(flags.canManageClients ? MANAGEMENT_NAV_ITEMS : []),
    ...(flags.canManagePayments ? PAYMENTS_NAV_ITEM : []),
    ...(flags.canViewTeam ? [TEAM_NAV_ITEM] : []),
    SETTINGS_NAV_ITEM,
  ]
}
