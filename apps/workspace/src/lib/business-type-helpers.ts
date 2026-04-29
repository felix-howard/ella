/**
 * Business type helpers — IRS Schedule C eligibility rules.
 * SOLE_PROPRIETORSHIP and SMLLC (single-member LLC, disregarded entity)
 * are the only business forms that file Schedule C.
 */
import type { BusinessType, ClientType } from './api-client'

const SCHEDULE_C_ELIGIBLE_BUSINESS_TYPES: ReadonlyArray<BusinessType> = [
  'SOLE_PROPRIETORSHIP',
  'SMLLC',
]

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  SOLE_PROPRIETORSHIP: 'Sole Prop',
  SMLLC: 'SMLLC',
  LLC: 'LLC',
  PARTNERSHIP: 'Partnership',
  S_CORP: 'S-Corp',
  C_CORP: 'C-Corp',
}

export function getBusinessTypeLabel(type: BusinessType | null | undefined): string {
  if (!type) return ''
  return BUSINESS_TYPE_LABELS[type] ?? type
}

interface MaybeBusinessClient {
  clientType: ClientType
  businessType?: BusinessType | null
}

export function isScheduleCEligibleBusiness(client: MaybeBusinessClient): boolean {
  if (client.clientType !== 'BUSINESS') return false
  if (!client.businessType) return false
  return SCHEDULE_C_ELIGIBLE_BUSINESS_TYPES.includes(client.businessType)
}
