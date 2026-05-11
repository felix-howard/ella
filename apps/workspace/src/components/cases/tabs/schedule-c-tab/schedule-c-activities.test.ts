import { describe, expect, it } from 'vitest'
import type { ClientPreview } from '../../../../lib/api-client'
import { getLinkedBusinessesWithScheduleC } from './schedule-c-activities'

function client(overrides: Partial<ClientPreview>): ClientPreview {
  return {
    id: 'client_1',
    name: 'Client One',
    clientType: 'INDIVIDUAL',
    phone: '+15555550100',
    ...overrides,
  }
}

describe('getLinkedBusinessesWithScheduleC', () => {
  it('keeps eligible business clients that own Schedule C records', () => {
    const businesses = getLinkedBusinessesWithScheduleC([
      client({
        id: 'biz_1',
        name: 'ABC Nails',
        clientType: 'BUSINESS',
        businessType: 'SMLLC',
        scheduleCExpense: {
          id: 'sc_1',
          status: 'SUBMITTED',
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
      }),
    ])

    expect(businesses.map((business) => business.id)).toEqual(['biz_1'])
  })

  it('ignores individual clients and non-Schedule-C business types', () => {
    const businesses = getLinkedBusinessesWithScheduleC([
      client({ id: 'person_1', clientType: 'INDIVIDUAL' }),
      client({
        id: 'corp_1',
        clientType: 'BUSINESS',
        businessType: 'S_CORP',
        scheduleCExpense: {
          id: 'sc_2',
          status: 'DRAFT',
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
      }),
    ])

    expect(businesses).toEqual([])
  })

  it('ignores eligible businesses without Schedule C records', () => {
    const businesses = getLinkedBusinessesWithScheduleC([
      client({
        id: 'biz_2',
        clientType: 'BUSINESS',
        businessType: 'SOLE_PROPRIETORSHIP',
        scheduleCExpense: null,
      }),
    ])

    expect(businesses).toEqual([])
  })
})
