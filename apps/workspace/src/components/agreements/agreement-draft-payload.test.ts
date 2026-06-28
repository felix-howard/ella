import { describe, expect, it } from 'vitest'
import type { Agreement } from '../../lib/api-client'
import {
  buildCreateAgreementPayload,
  buildSaveAgreementDraftPayload,
  createStep3DraftFromAgreement,
} from './agreement-draft-payload'
import {
  BLANK_TEMPLATE,
  BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
} from './wizard-steps/template-sentinels'

const resolved = {
  title: ' Engagement Letter ',
  contentHtml: ' <p>Prepared</p> ',
  depositEnabled: false,
  depositAmount: '500.00',
  internalNote: ' Internal only ',
  expiryDays: 30,
}

function draftAgreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    id: 'agreement-1',
    type: 'ENGAGEMENT_LETTER',
    title: 'Draft title',
    internalNote: 'Private',
    source: 'MANUAL',
    sourceSnapshot: null,
    leadId: 'lead-1',
    clientId: null,
    organizationId: 'org-1',
    templateId: null,
    templateVersion: 'v2',
    customContentHtml: '<p>Draft body</p>',
    status: 'DRAFT',
    depositStatus: null,
    depositAmount: null,
    depositPaidAt: null,
    depositResolvedAt: null,
    depositNote: null,
    expiresAt: null,
    expiryDays: 14,
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
    createdByUserId: 'staff-1',
    lastEditedByUserId: 'staff-1',
    sentByUserId: null,
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    createdAt: '2026-06-25T10:00:00.000Z',
    updatedAt: '2026-06-25T10:01:00.000Z',
    ...overrides,
  }
}

describe('agreement draft payload helpers', () => {
  it('normalizes editor output and omits client-only template sentinels', () => {
    expect(
      buildCreateAgreementPayload({
        type: 'ENGAGEMENT_LETTER',
        templateId: BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
        resolved,
      }),
    ).toEqual({
      type: 'ENGAGEMENT_LETTER',
      title: 'Engagement Letter',
      contentHtml: '<p>Prepared</p>',
      templateId: undefined,
      depositAmount: null,
      internalNote: 'Internal only',
      expiryDays: 30,
    })

    expect(
      buildCreateAgreementPayload({
        type: 'CUSTOM',
        templateId: BLANK_TEMPLATE,
        resolved: { ...resolved, depositEnabled: true },
      }).templateId,
    ).toBeUndefined()
  })

  it('adds draft source metadata for saved drafts', () => {
    expect(
      buildSaveAgreementDraftPayload({
        type: 'ENGAGEMENT_LETTER',
        templateId: null,
        resolved,
        source: 'CALCULATOR',
        sourceSnapshot: { quoteId: 'quote-1' },
      }),
    ).toMatchObject({
      type: 'ENGAGEMENT_LETTER',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote-1' },
    })
  })

  it('hydrates editor state from an existing draft row', () => {
    expect(createStep3DraftFromAgreement(draftAgreement())).toMatchObject({
      titleOverride: 'Draft title',
      htmlOverride: '<p>Draft body</p>',
      depositEnabledOverride: false,
      depositAmountOverride: null,
      internalNote: 'Private',
      expiryDays: 14,
    })
  })
})
