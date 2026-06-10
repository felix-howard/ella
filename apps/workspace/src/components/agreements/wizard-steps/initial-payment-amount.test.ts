import { describe, expect, it } from 'vitest'
import {
  formatPaymentAmountInput,
  sanitizePaymentAmountInput,
} from './initial-payment-amount'

describe('initial payment amount helpers', () => {
  it('sanitizes formatted currency input to the raw payload value', () => {
    expect(sanitizePaymentAmountInput('$1,500.50')).toBe('1500.50')
    expect(sanitizePaymentAmountInput('1.500.50')).toBe('1.50')
    expect(sanitizePaymentAmountInput('abc1500.567')).toBe('1500.56')
  })

  it('formats raw numeric strings as USD display values', () => {
    expect(formatPaymentAmountInput('1500')).toBe('$1,500')
    expect(formatPaymentAmountInput('1500.5')).toBe('$1,500.5')
    expect(formatPaymentAmountInput('1500.50')).toBe('$1,500.50')
  })
})
