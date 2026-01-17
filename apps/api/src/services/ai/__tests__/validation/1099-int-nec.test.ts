/**
 * Validation Tests: 1099-INT, 1099-NEC
 * Interest and Non-Employee Compensation forms
 */
import { describe, it, expect } from 'vitest'
import { validate1099IntData } from '../../prompts/ocr/1099-int'
import { validate1099NecData } from '../../prompts/ocr/1099-nec'

// =============================================================================
// 1099-INT VALIDATION TESTS
// =============================================================================
describe('validate1099IntData', () => {
  it('returns true for valid 1099-INT data', () => {
    const validData = {
      payerName: 'Chase Bank',
      payerAddress: '123 Bank St, City, ST 12345',
      payerTIN: '12-3456789',
      recipientName: 'JOHN DOE',
      recipientAddress: '456 Main St, City, ST 67890',
      recipientTIN: '123-45-6789',
      accountNumber: 'XXXX1234',
      interestIncome: 500.0,
      earlyWithdrawalPenalty: null,
      interestOnUSSavingsBonds: null,
      federalIncomeTaxWithheld: null,
      investmentExpenses: null,
      foreignTaxPaid: null,
      foreignCountry: null,
      taxExemptInterest: null,
      specifiedPrivateActivityBondInterest: null,
      marketDiscount: null,
      bondPremium: null,
      bondPremiumTreasury: null,
      bondPremiumTaxExempt: null,
      stateTaxInfo: [],
      taxYear: 2024,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099IntData(validData)).toBe(true)
  })

  it('returns false for missing payerName', () => {
    const invalidData = {
      recipientTIN: '123-45-6789',
      interestIncome: 500,
      stateTaxInfo: [],
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099IntData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean corrected field', () => {
    const invalidData = {
      payerName: 'Chase Bank',
      recipientTIN: '123-45-6789',
      interestIncome: 500,
      stateTaxInfo: [],
      corrected: 'false',
      fatcaFilingRequirement: false,
    }

    expect(validate1099IntData(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      payerName: 'Chase Bank',
      recipientTIN: '123-45-6789',
      interestIncome: 500,
      stateTaxInfo: 'not an array',
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099IntData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099IntData(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validate1099IntData('string')).toBe(false)
    expect(validate1099IntData(123)).toBe(false)
    expect(validate1099IntData(undefined)).toBe(false)
  })
})

// =============================================================================
// 1099-NEC VALIDATION TESTS
// =============================================================================
describe('validate1099NecData', () => {
  it('returns true for valid 1099-NEC data', () => {
    const validData = {
      payerName: 'ABC Consulting LLC',
      payerAddress: '123 Business Blvd, City, ST 12345',
      payerTIN: '12-3456789',
      payerPhone: '555-123-4567',
      recipientName: 'NGUYEN VAN A',
      recipientAddress: '456 Contractor St, City, ST 67890',
      recipientTIN: '123-45-6789',
      accountNumber: null,
      nonemployeeCompensation: 15000.0,
      payerMadeDirectSales: false, // Correct field name
      federalIncomeTaxWithheld: null,
      stateTaxInfo: [],
      taxYear: 2024,
      corrected: false,
    }

    expect(validate1099NecData(validData)).toBe(true)
  })

  it('returns false for missing payerName', () => {
    const invalidData = {
      recipientName: 'John Doe',
      recipientTIN: '123-45-6789',
      nonemployeeCompensation: 15000,
      payerMadeDirectSales: false,
      stateTaxInfo: [],
      corrected: false,
    }

    expect(validate1099NecData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean payerMadeDirectSales field', () => {
    const invalidData = {
      payerName: 'ABC Consulting',
      recipientName: 'John Doe',
      recipientTIN: '123-45-6789',
      nonemployeeCompensation: 15000,
      payerMadeDirectSales: 'false',
      stateTaxInfo: [],
      corrected: false,
    }

    expect(validate1099NecData(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      payerName: 'ABC Consulting',
      recipientName: 'John Doe',
      recipientTIN: '123-45-6789',
      nonemployeeCompensation: 15000,
      payerMadeDirectSales: false,
      stateTaxInfo: { state: 'CA' },
      corrected: false,
    }

    expect(validate1099NecData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099NecData(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validate1099NecData('string')).toBe(false)
    expect(validate1099NecData(123)).toBe(false)
    expect(validate1099NecData(undefined)).toBe(false)
  })
})
