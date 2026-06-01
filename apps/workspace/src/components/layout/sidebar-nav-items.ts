import {
  Calculator,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Settings,
  Users,
  UsersRound,
} from 'lucide-react'
import type { NavItem } from './sidebar-content'

const BASE_NAV_ITEMS = [
  { path: '/', i18nKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/clients', i18nKey: 'nav.clients', icon: Users },
  { path: '/messages', i18nKey: 'nav.messages', icon: MessageSquare },
] as const satisfies readonly NavItem[]

const ADMIN_NAV_ITEMS = [
  { path: '/leads', i18nKey: 'nav.leads', icon: Megaphone },
  { path: '/pricing-calculator', i18nKey: 'nav.pricingCalculator', icon: Calculator },
  { path: '/team', i18nKey: 'nav.team', icon: UsersRound },
] as const satisfies readonly NavItem[]

const SETTINGS_NAV_ITEM = {
  path: '/settings',
  i18nKey: 'nav.settings',
  icon: Settings,
} as const satisfies NavItem

export function getSidebarNavItems(isAdmin: boolean): NavItem[] {
  return [
    ...BASE_NAV_ITEMS,
    ...(isAdmin ? ADMIN_NAV_ITEMS : []),
    SETTINGS_NAV_ITEM,
  ]
}
