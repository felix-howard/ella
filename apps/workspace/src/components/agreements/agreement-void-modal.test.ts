import { describe, expect, it } from 'vitest'
import {
  isVoidAgreementReasonValid,
  normalizeVoidAgreementReason,
  VOID_REASON_MAX_LENGTH,
} from './agreement-void-modal'

describe('agreement void reason helpers', () => {
  it('trims the reason before submit', () => {
    expect(normalizeVoidAgreementReason('  Sent to wrong client  ')).toBe(
      'Sent to wrong client',
    )
  })

  it('requires a meaningful short reason', () => {
    expect(isVoidAgreementReasonValid('')).toBe(false)
    expect(isVoidAgreementReasonValid('   ')).toBe(false)
    expect(isVoidAgreementReasonValid('no')).toBe(false)
    expect(isVoidAgreementReasonValid('wrong recipient')).toBe(true)
  })

  it('enforces the server-backed maximum length', () => {
    expect(isVoidAgreementReasonValid('x'.repeat(VOID_REASON_MAX_LENGTH))).toBe(true)
    expect(isVoidAgreementReasonValid('x'.repeat(VOID_REASON_MAX_LENGTH + 1))).toBe(false)
  })
})
