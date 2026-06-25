import { describe, expect, it } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import type { Agreement } from '../../../lib/api-client'
import {
  buildCalculatorEngagementLetterDraftSeed,
  createCalculatorEngagementLetterDraft,
  findNewestCalculatorAgreementDraft,
  getCalculatorDraftEditorSourceSnapshot,
  isCalculatorDraftEntryDecisionPending,
  isCalculatorDraftLookupFailureWithoutDraft,
  shouldResolveCalculatorDraftEntry,
} from '../calculator-engagement-letter-modal-helpers'

function agreement(overrides: Partial<Agreement>): Agreement {
  return {
    id: 'agreement-1',
    type: 'ENGAGEMENT_LETTER',
    title: 'Draft',
    internalNote: null,
    source: 'CALCULATOR',
    sourceSnapshot: null,
    leadId: null,
    clientId: 'client_1',
    organizationId: 'org_1',
    templateId: null,
    templateVersion: 'v2',
    customContentHtml: '<p>Draft</p>',
    status: 'DRAFT',
    depositStatus: null,
    depositAmount: null,
    depositPaidAt: null,
    depositResolvedAt: null,
    depositNote: null,
    expiresAt: null,
    expiryDays: 30,
    isActive: false,
    lastUsedAt: null,
    usageCount: 0,
    signedAt: null,
    signerName: null,
    signerEmail: null,
    signedPdfKey: null,
    consentTaxpayerName: null,
    consentBusinessName: null,
    consentTinLastFour: null,
    createdByUserId: 'staff_1',
    lastEditedByUserId: 'staff_1',
    sentByUserId: null,
    createdAt: '2026-06-25T09:00:00.000Z',
    updatedAt: '2026-06-25T09:00:00.000Z',
    ...overrides,
  }
}

describe('calculator engagement letter modal helpers', () => {
  it('seeds the direct editor with calculator content and initial payment off', () => {
    const draft = createCalculatorEngagementLetterDraft('<h2>Prepared content</h2>')

    expect(draft.titleOverride).toBe('Engagement Letter')
    expect(draft.htmlOverride).toBe('<h2>Prepared content</h2>')
    expect(draft.depositEnabledOverride).toBe(false)
    expect(draft.expiryDays).toBe(30)
  })

  it('builds calculator draft seed with lean staff-only source metadata', () => {
    const pricingInput = createDefaultPricingInput()
    pricingInput.payrollEmployees = 3
    const pricingResult = calculatePricing(pricingInput)

    const seed = buildCalculatorEngagementLetterDraftSeed({
      recipient: { type: 'client', id: 'client_1' },
      pricingInput,
      pricingResult,
      preparedAt: new Date('2026-06-25T10:00:00.000Z'),
    })

    expect(seed).toMatchObject({
      type: 'ENGAGEMENT_LETTER',
      title: 'Engagement Letter',
      source: 'CALCULATOR',
      sourceSnapshot: {
        preparedAt: '2026-06-25T10:00:00.000Z',
        recipient: { type: 'client', id: 'client_1' },
        setupTotal: pricingResult.setupDisplayTotal,
        monthlyTotal: pricingResult.monthlyTotal,
        tierLabel: pricingResult.tierLabel,
      },
    })
    expect(seed.sourceSnapshot).not.toHaveProperty('pricingInput')
    expect(seed.sourceSnapshot).not.toHaveProperty('pricingResult')
    expect(seed.contentHtml).toContain('Prepared:</strong> June 25, 2026')
    expect(seed.contentHtml).toContain('Payroll employees (3 × $7, owner-manual): $21.')
    expect(seed.draft.depositEnabledOverride).toBe(false)
  })

  it('finds only the newest calculator-sourced draft', () => {
    const manualDraft = agreement({
      id: 'manual-newer',
      source: 'MANUAL',
      updatedAt: '2026-06-25T12:00:00.000Z',
    })
    const olderCalculatorDraft = agreement({
      id: 'calculator-older',
      updatedAt: '2026-06-25T10:00:00.000Z',
    })
    const newerCalculatorDraft = agreement({
      id: 'calculator-newer',
      updatedAt: '2026-06-25T11:00:00.000Z',
    })
    const sentCalculatorAgreement = agreement({
      id: 'calculator-sent',
      status: 'SENT',
      updatedAt: '2026-06-25T13:00:00.000Z',
    })

    expect(
      findNewestCalculatorAgreementDraft([
        manualDraft,
        olderCalculatorDraft,
        newerCalculatorDraft,
        sentCalculatorAgreement,
      ])?.id,
    ).toBe('calculator-newer')
  })

  it('does not replace a resumed draft null source snapshot with the current quote snapshot', () => {
    const pricingInput = createDefaultPricingInput()
    const draftSeed = buildCalculatorEngagementLetterDraftSeed({
      recipient: { type: 'client', id: 'client_1' },
      pricingInput,
      pricingResult: calculatePricing(pricingInput),
      preparedAt: new Date('2026-06-25T10:00:00.000Z'),
    })

    expect(
      getCalculatorDraftEditorSourceSnapshot(
        agreement({ sourceSnapshot: null }),
        draftSeed,
      ),
    ).toBeUndefined()
    expect(getCalculatorDraftEditorSourceSnapshot(null, draftSeed)).toBe(
      draftSeed.sourceSnapshot,
    )
  })

  it('freezes the entry draft decision after an initial no-draft lookup', () => {
    const newDraftAfterSave = agreement({ id: 'new-draft-after-save' })

    expect(shouldResolveCalculatorDraftEntry(undefined, false, false, null)).toBe(true)
    expect(isCalculatorDraftEntryDecisionPending(undefined, false, false, null)).toBe(true)
    expect(shouldResolveCalculatorDraftEntry(null, false, false, newDraftAfterSave)).toBe(false)
    expect(isCalculatorDraftLookupFailureWithoutDraft(null, true, newDraftAfterSave)).toBe(false)
  })

  it('still offers resume when cached calculator draft data exists with a refetch error', () => {
    const cachedDraft = agreement({ id: 'cached-draft' })

    expect(shouldResolveCalculatorDraftEntry(undefined, false, true, cachedDraft)).toBe(true)
    expect(isCalculatorDraftEntryDecisionPending(undefined, false, true, cachedDraft)).toBe(true)
    expect(isCalculatorDraftLookupFailureWithoutDraft(undefined, true, cachedDraft)).toBe(false)
    expect(isCalculatorDraftLookupFailureWithoutDraft(undefined, true, null)).toBe(true)
  })
})
