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
