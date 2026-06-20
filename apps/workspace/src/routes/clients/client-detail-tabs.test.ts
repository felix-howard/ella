import { describe, expect, it } from 'vitest'
import { getAvailableTabIds } from './client-detail-tabs'

describe('client detail tab availability', () => {
  it('hides agreements for managers on individual clients', () => {
    const tabs = getAvailableTabIds(
      { clientType: 'INDIVIDUAL' },
      { canManagePayments: false, canManageAgreements: false },
    )

    expect(tabs).not.toContain('agreements')
  })

  it('shows agreements for admins on individual clients', () => {
    const tabs = getAvailableTabIds(
      { clientType: 'INDIVIDUAL' },
      { canManagePayments: true, canManageAgreements: true },
    )

    expect(tabs).toContain('agreements')
  })

  it('never shows agreements for business clients', () => {
    const tabs = getAvailableTabIds(
      { clientType: 'BUSINESS', businessType: 'SOLE_PROPRIETORSHIP' },
      { canManagePayments: true, canManageAgreements: true },
    )

    expect(tabs).not.toContain('agreements')
  })
})
