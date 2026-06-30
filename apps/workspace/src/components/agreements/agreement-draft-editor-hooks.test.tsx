import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createDefaultPricingInput } from '@ella/shared/pricing'
import type {
  Agreement,
  CalculatorAgreementQuotePayload,
  CreateAgreementPayload,
  SaveAgreementDraftPayload,
  SendAgreementDraftPayload,
} from '../../lib/api-client'
import { useAgreementDraftPayloadState } from './use-agreement-draft-payload-state'
import { buildAgreementDraftAutosaveUpdatePayload } from './use-agreement-draft-autosave'
import { useAgreementDraftSubmitHandlers } from './use-agreement-draft-submit-handlers'
import {
  emptyStep3Draft,
  type Step3Resolved,
} from './wizard-steps/step3-content-editor'

const expectedUpdatedAt = '2026-06-25T10:00:00.000Z'

const resolved: Step3Resolved = {
  title: 'Engagement Letter',
  contentHtml: '<p>Prepared scope</p>',
  depositEnabled: false,
  depositAmount: '300.00',
  internalNote: '',
  expiryDays: 30,
}

const calculatorQuote: CalculatorAgreementQuotePayload = {
  pricingInput: createDefaultPricingInput(),
  paymentPortalMode: 'STAFF_REVIEW',
}

function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    id: 'draft-1',
    type: 'ENGAGEMENT_LETTER',
    title: 'Draft title',
    internalNote: null,
    source: 'CALCULATOR',
    sourceSnapshot: null,
    paymentQuoteId: null,
    paymentPortalMode: 'NONE',
    paymentQuote: null,
    leadId: null,
    clientId: 'client-1',
    organizationId: 'org-1',
    templateId: null,
    templateVersion: 'v2',
    customContentHtml: '<p>Prepared scope</p>',
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
    createdByUserId: 'staff-creator',
    lastEditedByUserId: 'staff-editor',
    sentByUserId: null,
    voidedAt: null,
    voidedByUserId: null,
    voidReason: null,
    createdAt: '2026-06-25T09:00:00.000Z',
    updatedAt: expectedUpdatedAt,
    ...overrides,
  }
}

describe('agreement draft editor hooks', () => {
  it('builds autosave updates with the latest saved draft timestamp', () => {
    const payload = {
      type: 'ENGAGEMENT_LETTER' as const,
      title: 'Engagement Letter',
      contentHtml: '<p>Prepared scope</p>',
      source: 'CALCULATOR' as const,
    }

    expect(buildAgreementDraftAutosaveUpdatePayload(payload, expectedUpdatedAt)).toEqual({
      ...payload,
      expectedUpdatedAt,
    })
  })

  it('keeps autosave payload unavailable until a draft has been explicitly saved', () => {
    const capturePayloadState =
      vi.fn<(state: ReturnType<typeof useAgreementDraftPayloadState>) => void>()

    function Probe({ saved }: { saved: boolean }) {
      const payloadState = useAgreementDraftPayloadState({
        draft: { ...emptyStep3Draft, titleOverride: 'Edited title' },
        savedAgreement: saved ? agreement() : null,
        savedResolved: saved ? resolved : null,
        fallbackTitle: 'Fallback title',
        type: 'ENGAGEMENT_LETTER',
        templateId: null,
        source: 'CALCULATOR',
        sourceSnapshot: { quoteId: 'quote-1' },
      })
      capturePayloadState(payloadState)
      return null
    }

    renderToStaticMarkup(<Probe saved={false} />)
    expect(capturePayloadState.mock.calls.at(-1)?.[0].autosavePayload).toBeNull()

    renderToStaticMarkup(<Probe saved />)
    expect(capturePayloadState.mock.calls.at(-1)?.[0].autosavePayload).toMatchObject({
      title: 'Edited title',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote-1' },
    })
  })

  it('omits full calculator quote from autosave once a payment quote is linked', () => {
    const capturePayloadState =
      vi.fn<(state: ReturnType<typeof useAgreementDraftPayloadState>) => void>()

    function Probe({ linked }: { linked: boolean }) {
      const payloadState = useAgreementDraftPayloadState({
        draft: { ...emptyStep3Draft, titleOverride: 'Edited title' },
        savedAgreement: agreement({ paymentQuoteId: linked ? 'quote-1' : null }),
        savedResolved: resolved,
        fallbackTitle: 'Fallback title',
        type: 'ENGAGEMENT_LETTER',
        templateId: null,
        source: 'CALCULATOR',
        sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
        calculatorQuote,
      })
      capturePayloadState(payloadState)
      return null
    }

    renderToStaticMarkup(<Probe linked={false} />)
    expect(capturePayloadState.mock.calls.at(-1)?.[0].autosavePayload).toMatchObject({
      calculatorQuote,
    })

    renderToStaticMarkup(<Probe linked />)
    expect(capturePayloadState.mock.calls.at(-1)?.[0].autosavePayload).not.toHaveProperty(
      'calculatorQuote',
    )
  })

  it('keeps save-draft available while unsaved submit sends immediately', () => {
    const captureHandlers =
      vi.fn<(handlers: ReturnType<typeof useAgreementDraftSubmitHandlers>) => void>()
    const createMutation = {
      mutate: vi.fn((_payload: CreateAgreementPayload, _options: { onSuccess: () => void }) => {}),
    }
    const savedDraft = agreement()
    const saveDraftMutation = {
      mutate: vi.fn((
        payload: SaveAgreementDraftPayload,
        options: { onSuccess: (res: { data: Agreement }) => void },
      ) => {
        options.onSuccess({ data: savedDraft })
        return payload
      }),
    }
    const sendDraftMutation = {
      mutate: vi.fn((
        _input: { agreementId: string; payload: SendAgreementDraftPayload },
        _options: { onSuccess: () => void; onError: (error: unknown) => void },
      ) => {}),
    }
    const resetSavedBaseline = vi.fn()
    const setSavedDraft = vi.fn()
    const setConflictMessage = vi.fn()
    const onClose = vi.fn()

    function Probe({ saved }: { saved: boolean }) {
      const handlers = useAgreementDraftSubmitHandlers({
        type: 'ENGAGEMENT_LETTER',
        templateId: null,
        effectiveTemplateId: null,
        source: 'CALCULATOR',
        sourceSnapshot: { quoteId: 'quote-1' },
        savedAgreement: saved ? savedDraft : null,
        createMutation,
        saveDraftMutation,
        sendDraftMutation,
        resetSavedBaseline,
        setSavedDraft,
        setConflictMessage,
        onClose,
        conflictMessage: 'Draft conflict',
      })
      captureHandlers(handlers)
      return null
    }

    renderToStaticMarkup(<Probe saved={false} />)
    const unsavedHandlers = captureHandlers.mock.calls.at(-1)?.[0]
    if (!unsavedHandlers) throw new Error('Expected unsaved draft handlers')

    unsavedHandlers.handleSaveDraft(resolved)
    expect(saveDraftMutation.mutate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Engagement Letter',
      source: 'CALCULATOR',
      sourceSnapshot: { quoteId: 'quote-1' },
    }), expect.any(Object))
    expect(setSavedDraft).toHaveBeenCalledWith(savedDraft, resolved)
    expect(resetSavedBaseline).toHaveBeenCalledWith(expect.objectContaining({
      source: 'CALCULATOR',
    }))

    unsavedHandlers.handleSubmit(resolved)
    expect(createMutation.mutate).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Engagement Letter',
      contentHtml: '<p>Prepared scope</p>',
    }), expect.objectContaining({ onSuccess: onClose }))
    expect(sendDraftMutation.mutate).not.toHaveBeenCalled()

    renderToStaticMarkup(<Probe saved />)
    const savedHandlers = captureHandlers.mock.calls.at(-1)?.[0]
    if (!savedHandlers) throw new Error('Expected saved draft handlers')

    savedHandlers.handleSubmit(resolved)
    expect(sendDraftMutation.mutate).toHaveBeenCalledWith({
      agreementId: 'draft-1',
      payload: expect.objectContaining({ expectedUpdatedAt }),
    }, expect.any(Object))
  })

  it('saves unsaved calculator quote drafts before sending them', () => {
    const captureHandlers =
      vi.fn<(handlers: ReturnType<typeof useAgreementDraftSubmitHandlers>) => void>()
    const createMutation = {
      mutate: vi.fn((_payload: CreateAgreementPayload, _options: { onSuccess: () => void }) => {}),
    }
    const savedDraft = agreement({
      id: 'draft-1',
      paymentQuoteId: 'quote-1',
      paymentPortalMode: 'STAFF_REVIEW',
    })
    const saveDraftMutation = {
      mutate: vi.fn((
        payload: SaveAgreementDraftPayload,
        options: { onSuccess: (res: { data: Agreement }) => void },
      ) => {
        options.onSuccess({ data: savedDraft })
        return payload
      }),
    }
    const sendDraftMutation = {
      mutate: vi.fn((
        _input: { agreementId: string; payload: SendAgreementDraftPayload },
        _options: { onSuccess: () => void; onError: (error: unknown) => void },
      ) => {}),
    }

    function Probe() {
      const handlers = useAgreementDraftSubmitHandlers({
        type: 'ENGAGEMENT_LETTER',
        templateId: null,
        effectiveTemplateId: null,
        source: 'CALCULATOR',
        sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
        calculatorQuote,
        paymentPortalMode: 'STAFF_REVIEW',
        savedAgreement: null,
        createMutation,
        saveDraftMutation,
        sendDraftMutation,
        resetSavedBaseline: vi.fn(),
        setSavedDraft: vi.fn(),
        setConflictMessage: vi.fn(),
        onClose: vi.fn(),
        conflictMessage: 'Draft conflict',
      })
      captureHandlers(handlers)
      return null
    }

    renderToStaticMarkup(<Probe />)
    const handlers = captureHandlers.mock.calls.at(-1)?.[0]
    if (!handlers) throw new Error('Expected calculator draft handlers')

    handlers.handleSubmit(resolved)

    expect(createMutation.mutate).not.toHaveBeenCalled()
    expect(saveDraftMutation.mutate).toHaveBeenCalledWith(expect.objectContaining({
      calculatorQuote,
      source: 'CALCULATOR',
    }), expect.any(Object))
    expect(sendDraftMutation.mutate).toHaveBeenCalledWith({
      agreementId: 'draft-1',
      payload: expect.objectContaining({
        expectedUpdatedAt,
        paymentPortalMode: 'STAFF_REVIEW',
      }),
    }, expect.any(Object))
  })
})
