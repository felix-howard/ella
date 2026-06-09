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
  { path: '/pricing-calculator', i18nKey: 'nav.pricingCalculator', icon: WalletCards },
] as const satisfies readonly NavItem[]

// Visible to ADMIN only (team management stays admin-gated)
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
  canManageTeam: boolean
}): NavItem[] {
  return [
    ...BASE_NAV_ITEMS,
    ...(flags.canManageClients ? MANAGEMENT_NAV_ITEMS : []),
    ...(flags.canManageTeam ? [TEAM_NAV_ITEM] : []),
    SETTINGS_NAV_ITEM,
  ]
}
