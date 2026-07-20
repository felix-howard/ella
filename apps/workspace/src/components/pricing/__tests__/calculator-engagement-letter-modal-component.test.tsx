// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import type * as ReactDOM from 'react-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { calculatePricing, createDefaultPricingInput } from '@ella/shared/pricing'
import type {
  Agreement,
  AgreementPaymentPortalSendMode,
  CalculatorAgreementQuotePayload,
} from '../../../lib/api-client'
import type { AgreementDraftSavedState } from '../../agreements/use-agreement-draft-saved-state'
import { CalculatorEngagementLetterModal } from '../calculator-engagement-letter-modal'
import { buildCalculatorEngagementLetterDraftSeed } from '../calculator-engagement-letter-modal-helpers'

interface CapturedDraftEditorProps {
  calculatorQuote?: CalculatorAgreementQuotePayload
  paymentPortalMode?: AgreementPaymentPortalSendMode
  sourceSnapshot?: Record<string, unknown>
  existingDraft?: Agreement
  hasExternalUnsavedChanges?: boolean
  onSavedStateChange?: (state: AgreementDraftSavedState | null) => void
}

type DraftChoiceMock = {
  isAgreementLookupLoading: boolean
  refetchAgreements: () => void
  draftDecisionPending: boolean
  lookupFailedWithoutDraft: boolean
  shouldChooseDraftMode: boolean
  calculatorDraftForChoice: Agreement | null
  selectedDraft: Agreement | null
  resumeDraft: () => void
  startCurrentQuote: () => void
  isStartingCurrentQuote: boolean
}

function createDraftChoice(overrides: Partial<DraftChoiceMock> = {}): DraftChoiceMock {
  return {
    isAgreementLookupLoading: false,
    refetchAgreements: vi.fn(),
    draftDecisionPending: false,
    lookupFailedWithoutDraft: false,
    shouldChooseDraftMode: false,
    calculatorDraftForChoice: null,
    selectedDraft: null,
    resumeDraft: vi.fn(),
    startCurrentQuote: vi.fn(),
    isStartingCurrentQuote: false,
    ...overrides,
  }
}

function agreement(overrides: Partial<Agreement> = {}): Agreement {
  return {
    id: 'draft-1',
    type: 'ENGAGEMENT_LETTER',
    title: 'Draft title',
    internalNote: null,
    source: 'CALCULATOR',
    sourceSnapshot: { paymentPortalMode: 'AUTO_SEND' },
    paymentQuoteId: 'quote-1',
    paymentPortalMode: 'AUTO_SEND',
    paymentQuote: null,
    leadId: null,
    clientId: 'client-1',
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
    updatedAt: '2026-06-25T10:00:00.000Z',
    ...overrides,
  }
}

const mocks = vi.hoisted(() => ({
  orgMode: 'STAFF_REVIEW' as AgreementPaymentPortalSendMode,
  draftChoice: {
    isAgreementLookupLoading: false,
    refetchAgreements: vi.fn(),
    draftDecisionPending: false,
    lookupFailedWithoutDraft: false,
    shouldChooseDraftMode: false,
    calculatorDraftForChoice: null,
    selectedDraft: null,
    resumeDraft: vi.fn(),
    startCurrentQuote: vi.fn(),
    isStartingCurrentQuote: false,
  } as DraftChoiceMock,
  editorProps: [] as CapturedDraftEditorProps[],
}))

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

let root: ReturnType<typeof createRoot> | null = null

vi.mock('react-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof ReactDOM>()
  return {
    ...actual,
    createPortal: (node: ReactNode) => node,
  }
})

vi.mock('react-i18next', () => ({
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string) => key,
  }),
}))

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    isLoading: false,
    isError: false,
    data: { calculatorAgreementPaymentMode: mocks.orgMode },
  }),
}))

vi.mock('../../agreements/use-nda-readiness', () => ({
  useNdaReadiness: () => ({
    isLoading: false,
    isFetching: false,
    isError: false,
    data: { ready: true, missing: [] },
  }),
}))

vi.mock('../use-calculator-engagement-letter-draft-choice', () => ({
  useCalculatorEngagementLetterDraftChoice: () => mocks.draftChoice,
}))

vi.mock('../../agreements/agreement-draft-editor', () => ({
  AgreementDraftEditor: (props: CapturedDraftEditorProps) => {
    mocks.editorProps.push(props)
    return <div>agreement-draft-editor</div>
  },
}))

describe('CalculatorEngagementLetterModal component payment mode plumbing', () => {
  beforeEach(() => {
    mocks.orgMode = 'STAFF_REVIEW'
    mocks.draftChoice = createDraftChoice()
    mocks.editorProps = []
  })

  afterEach(async () => {
    await act(async () => root?.unmount())
    root = null
    document.body.replaceChildren()
  })

  it('passes org default mode and calculatorQuote for a current calculator quote', () => {
    const pricingInput = createDefaultPricingInput()
    const draftSeed = buildCalculatorEngagementLetterDraftSeed({
      recipient: { type: 'client', id: 'client-1' },
      pricingInput,
      pricingResult: calculatePricing(pricingInput),
      preparedAt: new Date('2026-06-25T10:00:00.000Z'),
    })

    renderToStaticMarkup(
      <CalculatorEngagementLetterModal
        entity={{ type: 'client', id: 'client-1' }}
        recipientLabel="Ada Lovelace"
        draftSeed={draftSeed}
        onClose={() => undefined}
      />,
    )

    expect(mocks.editorProps[0]).toMatchObject({
      paymentPortalMode: 'STAFF_REVIEW',
      calculatorQuote: {
        pricingInput,
        paymentPortalMode: 'STAFF_REVIEW',
      },
      sourceSnapshot: {
        paymentPortalMode: 'STAFF_REVIEW',
      },
    })
    expect(mocks.editorProps[0].sourceSnapshot).not.toHaveProperty('pricingInput')
  })

  it('resumes saved draft mode without sending the current calculatorQuote', () => {
    const pricingInput = createDefaultPricingInput()
    const savedDraft = agreement({
      paymentPortalMode: 'AUTO_SEND',
      sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
    })
    mocks.orgMode = 'STAFF_REVIEW'
    mocks.draftChoice = createDraftChoice({ selectedDraft: savedDraft })

    renderToStaticMarkup(
      <CalculatorEngagementLetterModal
        entity={{ type: 'client', id: 'client-1' }}
        recipientLabel="Ada Lovelace"
        draftSeed={buildCalculatorEngagementLetterDraftSeed({
          recipient: { type: 'client', id: 'client-1' },
          pricingInput,
          pricingResult: calculatePricing(pricingInput),
        })}
        onClose={() => undefined}
      />,
    )

    expect(mocks.editorProps[0]).toMatchObject({
      existingDraft: savedDraft,
      paymentPortalMode: 'STAFF_REVIEW',
      sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
      hasExternalUnsavedChanges: false,
    })
    expect(mocks.editorProps[0]).not.toHaveProperty('calculatorQuote')
  })

  it('advances the payment-mode baseline without losing a newer choice', async () => {
    const savedDraft = agreement({
      paymentPortalMode: 'STAFF_REVIEW',
      sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
    })
    mocks.draftChoice = createDraftChoice({ selectedDraft: savedDraft })
    const pricingInput = createDefaultPricingInput()
    const container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    await act(async () => root?.render(
      <CalculatorEngagementLetterModal
        entity={{ type: 'client', id: 'client-1' }}
        recipientLabel="Ada Lovelace"
        draftSeed={buildCalculatorEngagementLetterDraftSeed({
          recipient: { type: 'client', id: 'client-1' },
          pricingInput,
          pricingResult: calculatePricing(pricingInput),
        })}
        onClose={vi.fn()}
      />,
    ))
    const pendingStaffReviewSaveProps = mocks.editorProps.at(-1)

    await act(async () => {
      container.querySelector<HTMLInputElement>('input[value="AUTO_SEND"]')?.click()
    })
    let latestProps = mocks.editorProps.at(-1)
    expect(latestProps).toMatchObject({
      paymentPortalMode: 'AUTO_SEND',
      hasExternalUnsavedChanges: true,
    })

    await act(async () => pendingStaffReviewSaveProps?.onSavedStateChange?.({
      agreement: agreement({
        paymentPortalMode: 'STAFF_REVIEW',
        sourceSnapshot: { paymentPortalMode: 'STAFF_REVIEW' },
      }),
      resolved: {} as AgreementDraftSavedState['resolved'],
    }))

    latestProps = mocks.editorProps.at(-1)
    expect(latestProps).toMatchObject({
      paymentPortalMode: 'AUTO_SEND',
      hasExternalUnsavedChanges: true,
    })

    await act(async () => latestProps?.onSavedStateChange?.({
      agreement: agreement({
        paymentPortalMode: 'AUTO_SEND',
        sourceSnapshot: { paymentPortalMode: 'AUTO_SEND' },
      }),
      resolved: {} as AgreementDraftSavedState['resolved'],
    }))

    latestProps = mocks.editorProps.at(-1)
    expect(latestProps).toMatchObject({
      paymentPortalMode: 'AUTO_SEND',
      hasExternalUnsavedChanges: false,
    })
  })
})
