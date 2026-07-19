import { describe, expect, it } from 'vitest'
import {
  getAvailableTabIds,
  parseClientDetailSearch,
  VALID_TAB_PARAMS,
} from './client-detail-tabs'

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

describe('client detail search parsing', () => {
  it('keeps only the focus id that belongs to the active tab', () => {
    expect(parseClientDetailSearch({
      tab: 'agreements',
      agreementId: ' agreement_1 ',
      quoteId: 'quote_ignored',
    })).toEqual({ tab: 'agreements', agreementId: 'agreement_1' })

    expect(parseClientDetailSearch({
      tab: 'payments',
      agreementId: 'agreement_ignored',
      quoteId: 'quote_1',
    })).toEqual({ tab: 'payments', quoteId: 'quote_1' })
  })

  it('drops invalid, stale, and mismatched focus ids', () => {
    expect(parseClientDetailSearch({
      tab: 'agreements',
      agreementId: '../agreement_1',
    })).toEqual({ tab: 'agreements', agreementId: undefined })
    expect(parseClientDetailSearch({ tab: 'services', quoteId: 'quote_1' }))
      .toEqual({ tab: 'services' })
    expect(parseClientDetailSearch({ tab: 'not-a-tab', agreementId: 'agreement_1' }))
      .toEqual({ tab: undefined })
  })
})
