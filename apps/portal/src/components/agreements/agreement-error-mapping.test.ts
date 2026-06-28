import { describe, expect, it } from 'vitest'
import type { AgreementPublicView } from '../../lib/api-client'
import { deriveStatusError, mapLoadError, mapSignError } from './agreement-error-mapping'

function apiError(status: number, code: string): Error & { status: number; code: string } {
  const err = new Error(code) as Error & { status: number; code: string }
  err.name = 'ApiError'
  err.status = status
  err.code = code
  return err
}

function publicView(overrides: Partial<AgreementPublicView> = {}): AgreementPublicView {
  return {
    type: 'NDA',
    status: 'SENT',
    expiresAt: null,
    expired: false,
    templateVersion: 'v2',
    templateTitle: 'Agreement',
    templateSubtitle: null,
    templateSections: [],
    templateHtml: null,
    uploadedPdfUrl: null,
    depositAmount: null,
    orgName: 'Tax Office',
    leadFirstName: 'Ada',
    firmSnapshot: null,
    clientSnapshot: null,
    consentPrefill: null,
    ...overrides,
  }
}

describe('agreement error mapping', () => {
  it('maps voided public load and sign errors from API error code', () => {
    expect(mapLoadError(apiError(409, 'AGREEMENT_VOIDED'))).toBe('voided')
    expect(mapSignError(apiError(409, 'AGREEMENT_VOIDED'))).toBe('voided')
  })

  it('keeps signed, inactive, expired, and rate-limited behavior distinct', () => {
    expect(mapLoadError(apiError(409, 'AGREEMENT_SIGNED'))).toBe('signed')
    expect(mapLoadError(apiError(409, 'AGREEMENT_INACTIVE'))).toBe('invalid')
    expect(mapLoadError(apiError(409, 'UNKNOWN_ERROR'))).toBe('signed')
    expect(mapLoadError(apiError(410, 'UNKNOWN_ERROR'))).toBe('expired')
    expect(mapSignError(apiError(409, 'AGREEMENT_INACTIVE'))).toBe('invalid')
    expect(mapSignError(apiError(429, 'RATE_LIMITED'))).toBe('rate_limited')
  })

  it('derives defensive status errors without exposing the document', () => {
    expect(deriveStatusError(publicView({ status: 'VOIDED' }))).toBe('voided')
    expect(deriveStatusError(publicView({ status: 'SIGNED' }))).toBe('signed')
    expect(deriveStatusError(publicView({ expired: true }))).toBe('expired')
    expect(deriveStatusError(publicView())).toBeNull()
  })
})
