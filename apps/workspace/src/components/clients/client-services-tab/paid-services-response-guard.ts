import type {
  ClientPaidServiceGroup,
  ClientPaidServiceItem,
  ClientPaidServicesResponse,
} from '../../../lib/api-client'

const SOURCES = new Set(['CALCULATOR_AGREEMENT', 'CUSTOM_LINK'])
const CATEGORIES = new Set(['RECURRING', 'ONE_TIME'])
const CADENCES = new Set(['MONTH', 'YEAR', 'ONE_TIME'])
const STATUSES = new Set(['PAID', 'ACTIVE', 'PAST_DUE', 'ENDED', 'REFUNDED'])
const RESPONSE_KEYS = new Set(['success', 'data', 'meta'])
const META_KEYS = new Set(['isTruncated', 'limit'])
const GROUP_KEYS = new Set(['id', 'source', 'paidAt', 'agreement', 'items'])
const AGREEMENT_KEYS = new Set(['id', 'title', 'signedAt'])
const ITEM_KEYS = new Set([
  'id',
  'label',
  'description',
  'category',
  'cadence',
  'status',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: ReadonlySet<string>): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.size && keys.every((key) => expected.has(key))
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isAgreement(value: unknown): boolean {
  return value === null || (
    isRecord(value) &&
    hasExactKeys(value, AGREEMENT_KEYS) &&
    typeof value.id === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.signedAt)
  )
}

function isPaidServiceItem(value: unknown): value is ClientPaidServiceItem {
  return (
    isRecord(value) &&
    hasExactKeys(value, ITEM_KEYS) &&
    typeof value.id === 'string' &&
    typeof value.label === 'string' &&
    isNullableString(value.description) &&
    typeof value.category === 'string' &&
    CATEGORIES.has(value.category) &&
    typeof value.cadence === 'string' &&
    CADENCES.has(value.cadence) &&
    typeof value.status === 'string' &&
    STATUSES.has(value.status)
  )
}

function isPaidServiceGroup(value: unknown): value is ClientPaidServiceGroup {
  return (
    isRecord(value) &&
    hasExactKeys(value, GROUP_KEYS) &&
    typeof value.id === 'string' &&
    typeof value.source === 'string' &&
    SOURCES.has(value.source) &&
    typeof value.paidAt === 'string' &&
    !Number.isNaN(Date.parse(value.paidAt)) &&
    isAgreement(value.agreement) &&
    Array.isArray(value.items) &&
    value.items.length > 0 &&
    value.items.every(isPaidServiceItem)
  )
}

function isResponseMeta(value: unknown): boolean {
  return (
    isRecord(value) &&
    hasExactKeys(value, META_KEYS) &&
    typeof value.isTruncated === 'boolean' &&
    Number.isInteger(value.limit) &&
    Number(value.limit) > 0
  )
}

export function assertClientPaidServicesResponse(
  value: unknown,
): asserts value is ClientPaidServicesResponse {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, RESPONSE_KEYS) ||
    value.success !== true ||
    !Array.isArray(value.data) ||
    !value.data.every(isPaidServiceGroup) ||
    !isResponseMeta(value.meta)
  ) {
    throw new Error('Invalid paid services response')
  }
}
