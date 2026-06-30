import type {
  Agreement,
  AgreementSource,
  AgreementType,
  CalculatorAgreementQuotePayload,
  CreateAgreementPayload,
  AgreementPaymentPortalSendMode,
  SaveAgreementDraftPayload,
  SendAgreementDraftPayload,
} from '../../lib/api-client'
import type {
  Step3Draft,
  Step3Resolved,
} from './wizard-steps/step3-content-editor'
import {
  BLANK_TEMPLATE,
  BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
  BUILTIN_NDA_TEMPLATE,
  UPLOAD_PDF_TEMPLATE,
} from './wizard-steps/template-sentinels'

interface DraftPayloadInput {
  type: AgreementType
  templateId: string | null
  resolved: Step3Resolved
}

interface SaveDraftPayloadInput extends DraftPayloadInput {
  source: AgreementSource
  sourceSnapshot?: Record<string, unknown>
  calculatorQuote?: CalculatorAgreementQuotePayload
}

interface SendDraftPayloadInput extends DraftPayloadInput {
  expectedUpdatedAt: string
  paymentPortalMode?: AgreementPaymentPortalSendMode
}

function realTemplateId(templateId: string | null): string | undefined {
  if (
    !templateId ||
    templateId === BLANK_TEMPLATE ||
    templateId === BUILTIN_NDA_TEMPLATE ||
    templateId === BUILTIN_ENGAGEMENT_LETTER_TEMPLATE ||
    templateId === UPLOAD_PDF_TEMPLATE
  ) {
    return undefined
  }
  return templateId
}

export function createPayloadSignature(payload: SaveAgreementDraftPayload): string {
  return JSON.stringify(payload)
}

export function buildCreateAgreementPayload({
  type,
  templateId,
  resolved,
}: DraftPayloadInput): CreateAgreementPayload {
  return {
    type,
    title: resolved.title.trim() || undefined,
    contentHtml: resolved.contentHtml.trim() || undefined,
    templateId: realTemplateId(templateId),
    depositAmount: resolved.depositEnabled ? resolved.depositAmount : null,
    internalNote: resolved.internalNote.trim() || undefined,
    expiryDays: resolved.expiryDays,
  }
}

export function buildSaveAgreementDraftPayload({
  type,
  templateId,
  resolved,
  source,
  sourceSnapshot,
  calculatorQuote,
}: SaveDraftPayloadInput): SaveAgreementDraftPayload {
  return {
    ...buildCreateAgreementPayload({ type, templateId, resolved }),
    source,
    ...(sourceSnapshot !== undefined ? { sourceSnapshot } : {}),
    ...(calculatorQuote ? { calculatorQuote } : {}),
  }
}

export function buildSendAgreementDraftPayload(
  input: SendDraftPayloadInput,
): SendAgreementDraftPayload {
  return {
    ...buildCreateAgreementPayload(input),
    expectedUpdatedAt: input.expectedUpdatedAt,
    ...(input.paymentPortalMode ? { paymentPortalMode: input.paymentPortalMode } : {}),
  }
}

export function createStep3DraftFromAgreement(agreement: Agreement): Step3Draft {
  return {
    titleOverride: agreement.title,
    htmlOverride: agreement.customContentHtml ?? '',
    placeholderValues: {},
    serviceItems: [],
    appliedPlaceholderValues: {},
    appliedServiceItems: [],
    depositEnabledOverride: agreement.depositAmount !== null,
    depositAmountOverride: agreement.depositAmount,
    internalNote: agreement.internalNote ?? '',
    expiryDays: agreement.expiryDays,
  }
}

export function createStep3ResolvedFromAgreement(agreement: Agreement): Step3Resolved {
  return {
    title: agreement.title,
    contentHtml: agreement.customContentHtml ?? '',
    depositEnabled: agreement.depositAmount !== null,
    depositAmount: agreement.depositAmount ?? '',
    internalNote: agreement.internalNote ?? '',
    expiryDays: agreement.expiryDays,
  }
}
