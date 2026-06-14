import { describe, expect, it } from 'vitest'
import { getSidebarNavItems } from '../sidebar-nav-items'

describe('getSidebarNavItems', () => {
  it('hides management nav from staff users', () => {
    const paths = getSidebarNavItems({
      canManageClients: false,
      canManagePayments: false,
      canViewTeam: true,
    }).map(
      (item) => item.path
    )

    expect(paths).toEqual(['/', '/clients', '/messages', '/team', '/settings'])
    expect(paths).not.toContain('/pricing-calculator')
  })

  it('shows management nav and Team to manager users', () => {
    const paths = getSidebarNavItems({
      canManageClients: true,
      canManagePayments: false,
      canViewTeam: true,
    }).map(
      (item) => item.path
    )

    expect(paths).toEqual([
      '/',
      '/clients',
      '/messages',
      '/leads',
      '/team',
      '/settings',
    ])
    expect(paths).not.toContain('/pricing-calculator')
  })

  it('shows all nav including Team to admin users', () => {
    const paths = getSidebarNavItems({
      canManageClients: true,
      canManagePayments: true,
      canViewTeam: true,
    }).map(
      (item) => item.path
    )

    expect(paths).toContain('/pricing-calculator')
    expect(paths).toEqual([
      '/',
      '/clients',
      '/messages',
      '/leads',
      '/pricing-calculator',
      '/team',
      '/settings',
    ])
  })
})
