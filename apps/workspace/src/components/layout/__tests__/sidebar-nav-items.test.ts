import { describe, expect, it } from 'vitest'
import { getSidebarNavItems } from '../sidebar-nav-items'

describe('getSidebarNavItems', () => {
  it('hides Pricing Calculator from non-admin users', () => {
    const paths = getSidebarNavItems(false).map((item) => item.path)

    expect(paths).toEqual(['/', '/clients', '/messages', '/settings'])
    expect(paths).not.toContain('/pricing-calculator')
  })

  it('shows Pricing Calculator to admin users', () => {
    const paths = getSidebarNavItems(true).map((item) => item.path)

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
