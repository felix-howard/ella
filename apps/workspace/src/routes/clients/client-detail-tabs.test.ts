import { describe, expect, it } from 'vitest'
import { getAvailableTabIds, VALID_TAB_PARAMS } from './client-detail-tabs'

const noManagementFlags = {
  canManagePayments: false,
  canManageAgreements: false,
} as const

const fullManagementFlags = {
  canManagePayments: true,
  canManageAgreements: true,
} as const

describe('client detail tab availability', () => {
  it('keeps services as a valid URL tab', () => {
    expect(VALID_TAB_PARAMS).toContain('services')
  })

  it('shows services for individual clients', () => {
    const tabs = getAvailableTabIds({ clientType: 'INDIVIDUAL' }, noManagementFlags)

    expect(tabs).toContain('services')
    expect(tabs.indexOf('services')).toBe(tabs.indexOf('files') + 1)
  })

  it('shows services for business clients', () => {
    const tabs = getAvailableTabIds(
      { clientType: 'BUSINESS', businessType: 'PARTNERSHIP' },
      noManagementFlags,
    )

    expect(tabs).toContain('services')
    expect(tabs.indexOf('services')).toBe(tabs.indexOf('files') + 1)
  })

  it('hides agreements for managers on individual clients', () => {
    const tabs = getAvailableTabIds({ clientType: 'INDIVIDUAL' }, noManagementFlags)

    expect(tabs).not.toContain('agreements')
  })

  it('shows agreements for admins on individual clients', () => {
    const tabs = getAvailableTabIds({ clientType: 'INDIVIDUAL' }, fullManagementFlags)

    expect(tabs).toContain('agreements')
  })

  it('never shows agreements for business clients', () => {
    const tabs = getAvailableTabIds(
      { clientType: 'BUSINESS', businessType: 'SOLE_PROPRIETORSHIP' },
      fullManagementFlags,
    )

    expect(tabs).not.toContain('agreements')
  })
})
