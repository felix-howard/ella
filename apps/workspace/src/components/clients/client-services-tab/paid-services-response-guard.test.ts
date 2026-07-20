import { describe, expect, it } from 'vitest'
import type { ClientPaidServicesResponse } from '../../../lib/api-client'
import { assertClientPaidServicesResponse } from './paid-services-response-guard'

const validResponse: ClientPaidServicesResponse = {
  success: true,
  meta: { isTruncated: false, limit: 100 },
  data: [{
    id: 'quote_1',
    source: 'CUSTOM_LINK',
    paidAt: '2026-07-15T10:00:00.000Z',
    agreement: null,
    items: [{
      id: 'line-1',
      label: 'Tax planning',
      description: null,
      category: 'ONE_TIME',
      cadence: 'ONE_TIME',
      status: 'PAID',
    }],
  }],
}

const validGroup = validResponse.data[0]
const validItem = validGroup.items[0]
const validAgreement = {
  id: 'agreement_1',
  title: '2026 Tax Agreement',
  signedAt: '2026-07-14T09:00:00.000Z',
}

function responseWithGroup(overrides: Record<string, unknown>): unknown {
  return {
    success: true,
    meta: validResponse.meta,
    data: [{ ...validGroup, ...overrides }],
  }
}

function responseWithAgreement(overrides: Record<string, unknown>): unknown {
  return responseWithGroup({
    source: 'CALCULATOR_AGREEMENT',
    agreement: { ...validAgreement, ...overrides },
  })
}

function responseWithItem(overrides: Record<string, unknown>): unknown {
  return responseWithGroup({
    items: [{ ...validItem, ...overrides }],
  })
}

describe('assertClientPaidServicesResponse', () => {
  it.each([
    ['custom-link response', validResponse],
    ['empty response', { success: true, data: [], meta: validResponse.meta }],
    [
      'calculator response',
      responseWithGroup({
        source: 'CALCULATOR_AGREEMENT',
        agreement: validAgreement,
      }),
    ],
  ])('accepts a valid %s', (_name, value) => {
    expect(() => assertClientPaidServicesResponse(value)).not.toThrow()
  })

  it.each([
    ['top-level key', { ...validResponse, metadata: { requestId: 'request_1' } }],
    ['meta key', { ...validResponse, meta: { ...validResponse.meta, total: 101 } }],
    ['service amount', responseWithGroup({ amount: 25_000 })],
    ['service receipt', responseWithGroup({ receiptUrl: 'https://stripe.test/receipt' })],
    ['service token', responseWithGroup({ payToken: 'secret-token' })],
    ['service raw snapshot', responseWithGroup({ resultSnapshot: { total: 25_000 } })],
    ['service Stripe field', responseWithGroup({ stripeCheckoutSessionId: 'cs_test_1' })],
    ['agreement key', responseWithAgreement({ signingToken: 'secret-token' })],
    ['item key', responseWithItem({ stripePriceId: 'price_1' })],
  ])('rejects an unexpected %s', (_name, value) => {
    expect(() => assertClientPaidServicesResponse(value)).toThrow(
      'Invalid paid services response',
    )
  })

  it.each([
    ['null envelope', null],
    ['array envelope', []],
    ['missing success', { data: [], meta: validResponse.meta }],
    ['false success', { success: false, data: [], meta: validResponse.meta }],
    ['null data', { success: true, data: null, meta: validResponse.meta }],
    ['null meta', { success: true, data: [], meta: null }],
    ['invalid limit', { success: true, data: [], meta: { isTruncated: false, limit: 0 } }],
    ['null service', { success: true, data: [null], meta: validResponse.meta }],
    ['non-string service id', responseWithGroup({ id: 1 })],
    ['unknown source', responseWithGroup({ source: 'DIRECT' })],
    ['invalid paid date', responseWithGroup({ paidAt: 'not-a-date' })],
    ['non-object agreement', responseWithGroup({ agreement: 'agreement_1' })],
    ['null items', responseWithGroup({ items: null })],
    ['empty items', responseWithGroup({ items: [] })],
    ['non-string agreement id', responseWithAgreement({ id: 1 })],
    ['non-string agreement title', responseWithAgreement({ title: null })],
    ['invalid agreement signed date type', responseWithAgreement({ signedAt: 1 })],
    ['non-string item id', responseWithItem({ id: 1 })],
    ['non-string item label', responseWithItem({ label: null })],
    ['invalid item description type', responseWithItem({ description: 1 })],
    ['unknown category', responseWithItem({ category: 'HOURLY' })],
    ['unknown cadence', responseWithItem({ cadence: 'WEEK' })],
    ['unknown status', responseWithItem({ status: 'UNKNOWN' })],
  ])('rejects malformed payload: %s', (_name, value) => {
    expect(() => assertClientPaidServicesResponse(value)).toThrow(
      'Invalid paid services response',
    )
  })
})
