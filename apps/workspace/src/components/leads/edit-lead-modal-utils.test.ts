import type { TFunction } from 'i18next'
import { describe, expect, it } from 'vitest'
import type { Lead } from '../../lib/api-client'
import {
  buildEditLeadUpdatePayload,
  buildInitialEditLeadForm,
  canEditLeadPhone,
  formatLeadPhoneInput,
  toE164Phone,
  validateEditLeadForm,
} from './edit-lead-modal-utils'

const t = ((_key: string, fallback: string) => fallback) as unknown as TFunction

const baseLead: Lead = {
  id: 'lead-1',
  firstName: 'Ana',
  lastName: 'Nguyen',
  phone: '+14055016270',
  email: 'ana@example.com',
  businessName: null,
  status: 'NEW',
  campaignTag: null,
  tags: [],
  notes: null,
  convertedToId: null,
  convertedAt: null,
  createdAt: '2026-06-15T00:00:00.000Z',
  updatedAt: '2026-06-15T00:00:00.000Z',
}

describe('edit lead modal phone helpers', () => {
  it('normalizes pasted US country-code phone values before formatting and saving', () => {
    expect(formatLeadPhoneInput('+1 405 501 6270')).toBe('(405) 501-6270')
    expect(toE164Phone('+1 405 501 6270')).toBe('+14055016270')
  })

  it('ignores extra pasted digits after a US phone number', () => {
    expect(formatLeadPhoneInput('+1 (405) 501-6270 ext 99')).toBe('(405) 501-6270')
    expect(toE164Phone('+1 (405) 501-6270 ext 99')).toBe('+14055016270')
  })

  it('preserves unchanged masked phone values and can skip phone validation', () => {
    const form = buildInitialEditLeadForm({ ...baseLead, phone: '*** *** 6270' })

    expect(form.phone).toBe('*** *** 6270')
    expect(canEditLeadPhone(form.phone)).toBe(false)
    expect(validateEditLeadForm(form, t, { validatePhone: false })).toEqual({})
    expect(validateEditLeadForm(form, t, { validatePhone: true })).toMatchObject({
      phone: 'Phone must be 10 digits',
    })
  })

  it('allows editing only when the lead phone is unmasked', () => {
    expect(canEditLeadPhone('+14055016270')).toBe(true)
    expect(canEditLeadPhone('*** *** 6270')).toBe(false)
  })

  it('builds update payloads with changed fields only', () => {
    const initialForm = buildInitialEditLeadForm(baseLead)
    const form = {
      ...initialForm,
      email: 'ana.new@example.com',
    }

    expect(buildEditLeadUpdatePayload(form, initialForm, { canEditPhone: true })).toEqual({
      email: 'ana.new@example.com',
    })
  })

  it('never includes phone in the update payload when the initial phone is masked', () => {
    const initialForm = buildInitialEditLeadForm({ ...baseLead, phone: '*** *** 6270' })
    const form = {
      ...initialForm,
      phone: '(555) 765-4321',
    }

    expect(buildEditLeadUpdatePayload(form, initialForm, { canEditPhone: false })).toEqual({})
  })
})
