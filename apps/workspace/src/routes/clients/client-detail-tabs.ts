import type { BusinessType } from '../../lib/api-client'
import { isScheduleCEligibleBusiness } from '../../lib/business-type-helpers'

export type TabType =
  | 'overview'
  | 'files'
  | 'services'
  | 'checklist'
  | 'schedule-c'
  | 'schedule-e'
  | 'data-entry'
  | 'shared-docs'
  | 'contractors'
  | 'agreements'
  | 'payments'

const BASE_CLIENT_TAB_IDS: TabType[] = ['overview', 'files', 'services']

export const VALID_TAB_PARAMS: TabType[] = [
  ...BASE_CLIENT_TAB_IDS,
  'checklist',
  'schedule-c',
  'schedule-e',
  'data-entry',
  'shared-docs',
  'contractors',
  'agreements',
  'payments',
]

export const DEFAULT_CLIENT_TAB: TabType = 'files'

export interface ClientDetailSearch {
  tab?: TabType
  agreementId?: string
  quoteId?: string
}

const CLIENT_DETAIL_FOCUS_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/

function parseFocusId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const normalized = value.trim()
  return CLIENT_DETAIL_FOCUS_ID_PATTERN.test(normalized) ? normalized : undefined
}

export function parseClientDetailSearch(search: Record<string, unknown>): ClientDetailSearch {
  const tab = VALID_TAB_PARAMS.includes(search.tab as TabType)
    ? (search.tab as TabType)
    : undefined

  if (tab === 'agreements') {
    return { tab, agreementId: parseFocusId(search.agreementId) }
  }
  if (tab === 'payments') {
    return { tab, quoteId: parseFocusId(search.quoteId) }
  }
  return { tab }
}

export function getAvailableTabIds(
  client: { clientType: 'INDIVIDUAL' | 'BUSINESS'; businessType?: BusinessType | null } | null | undefined,
  flags: { canManagePayments: boolean; canManageAgreements: boolean } = {
    canManagePayments: true,
    canManageAgreements: true,
  },
): TabType[] {
  if (!client) return VALID_TAB_PARAMS

  const paymentsTabs: TabType[] = flags.canManagePayments ? ['payments'] : []
  const agreementsTabs: TabType[] = flags.canManageAgreements ? ['agreements'] : []

  if (client.clientType === 'BUSINESS') {
    const scheduleCTabs: TabType[] = isScheduleCEligibleBusiness(client) ? ['schedule-c'] : []

    return [
      ...BASE_CLIENT_TAB_IDS,
      'contractors',
      'data-entry',
      'shared-docs',
      ...paymentsTabs,
      ...scheduleCTabs,
    ]
  }

  return [
    ...BASE_CLIENT_TAB_IDS,
    ...agreementsTabs,
    ...paymentsTabs,
    'data-entry',
    'shared-docs',
    'schedule-c',
    'schedule-e',
  ]
}
