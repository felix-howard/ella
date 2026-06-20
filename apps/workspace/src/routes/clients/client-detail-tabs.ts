import type { BusinessType } from '../../lib/api-client'
import { isScheduleCEligibleBusiness } from '../../lib/business-type-helpers'

export type TabType =
  | 'overview'
  | 'files'
  | 'checklist'
  | 'schedule-c'
  | 'schedule-e'
  | 'data-entry'
  | 'shared-docs'
  | 'contractors'
  | 'agreements'
  | 'payments'

export const VALID_TAB_PARAMS: TabType[] = [
  'overview',
  'files',
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

  const paymentsTabs = flags.canManagePayments ? (['payments'] as TabType[]) : []
  const agreementsTabs = flags.canManageAgreements ? (['agreements'] as TabType[]) : []

  if (client.clientType === 'BUSINESS') {
    return [
      'overview',
      'files',
      'contractors',
      'data-entry',
      'shared-docs',
      ...paymentsTabs,
      ...(isScheduleCEligibleBusiness(client) ? (['schedule-c'] as TabType[]) : []),
    ]
  }

  return [
    'overview',
    'files',
    ...agreementsTabs,
    ...paymentsTabs,
    'data-entry',
    'shared-docs',
    'schedule-c',
    'schedule-e',
  ]
}
