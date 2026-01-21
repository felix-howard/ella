/**
 * Validation Tests: Bank Statement, 1099-DIV, 1099-R
 * Financial and retirement document validation
 */
import { describe, it, expect } from 'vitest'
import { validateBankStatementData } from '../../prompts/ocr/bank-statement'
import { validate1099DivData } from '../../prompts/ocr/1099-div'
import { validate1099RData } from '../../prompts/ocr/1099-r'

// =============================================================================
// BANK STATEMENT VALIDATION TESTS
// =============================================================================
describe('validateBankStatementData', () => {
  it('returns true for valid bank statement data', () => {
    const validData = {
      bankName: 'Chase Bank',
      bankAddress: '123 Bank St, City, ST 12345',
      accountNumber: '****1234',
      accountType: 'BUSINESS',
      accountHolderName: 'ABC Nail Salon LLC',
      accountHolderAddress: '456 Main St, City, ST 67890',
      statementPeriodStart: '01/01/2024',
      statementPeriodEnd: '01/31/2024',
      beginningBalance: 15000.0,
      endingBalance: 18500.0,
      totalDeposits: 25000.0,
      totalWithdrawals: 21500.0,
      depositCount: 45,
      withdrawalCount: 38,
      largeDeposits: [{ date: '01/15/2024', description: 'Square Inc Deposit', amount: 8500.0 }],
      largeWithdrawals: [{ date: '01/05/2024', description: 'Rent Payment', amount: 3500.0 }],
      totalFees: 25.0,
      interestEarned: null,
      pageNumber: 1,
      totalPages: 3,
    }

    expect(validateBankStatementData(validData)).toBe(true)
  })

  it('returns false for missing bankName', () => {
    const invalidData = {
      accountNumber: '****1234',
      beginningBalance: 15000,
      endingBalance: 18500,
      largeDeposits: [],
      largeWithdrawals: [],
    }

    expect(validateBankStatementData(invalidData)).toBe(false)
  })

  it('returns false for non-array largeDeposits', () => {
    const invalidData = {
      bankName: 'Chase Bank',
      accountNumber: '****1234',
      beginningBalance: 15000,
      endingBalance: 18500,
      largeDeposits: 'not an array',
      largeWithdrawals: [],
    }

    expect(validateBankStatementData(invalidData)).toBe(false)
  })

  it('returns false for non-number beginningBalance', () => {
    const invalidData = {
      bankName: 'Chase Bank',
      accountNumber: '****1234',
      beginningBalance: '15000', // should be number
      endingBalance: 18500,
      largeDeposits: [],
      largeWithdrawals: [],
    }

    expect(validateBankStatementData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validateBankStatementData(null)).toBe(false)
  })
})

// =============================================================================
// 1099-DIV VALIDATION TESTS
// =============================================================================
describe('validate1099DivData', () => {
  it('returns true for valid 1099-DIV data', () => {
    const validData = {
      payerName: 'Vanguard Group',
      payerAddress: '100 Vanguard Blvd, Malvern, PA 19355',
      payerTIN: '12-3456789',
      recipientName: 'JOHN DOE',
      recipientAddress: '123 Main St, City, ST 12345',
      recipientTIN: '123-45-6789',
      accountNumber: 'XXXX1234',
      totalOrdinaryDividends: 1500.0,
      qualifiedDividends: 1200.0,
      totalCapitalGainDistr: 500.0,
      stateTaxInfo: [],
      taxYear: 2024,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099DivData(validData)).toBe(true)
  })

  it('returns false for missing payerName', () => {
    const invalidData = {
      recipientTIN: '123-45-6789',
      totalOrdinaryDividends: 1500,
      stateTaxInfo: [],
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099DivData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean corrected field', () => {
    const invalidData = {
      payerName: 'Vanguard',
      recipientTIN: '123-45-6789',
      totalOrdinaryDividends: 1500,
      stateTaxInfo: [],
      corrected: 'false',
      fatcaFilingRequirement: false,
    }

    expect(validate1099DivData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099DivData(null)).toBe(false)
  })
})

// =============================================================================
// 1099-R VALIDATION TESTS
// =============================================================================
describe('validate1099RData', () => {
  it('returns true for valid 1099-R data', () => {
    const validData = {
      payerName: 'Fidelity Investments',
      payerAddress: '100 Fidelity Way, Boston, MA 02210',
      payerTIN: '12-3456789',
      recipientName: 'JOHN DOE',
      recipientAddress: '123 Main St, City, ST 12345',
      recipientTIN: '123-45-6789',
      accountNumber: 'XXXX5678',
      grossDistribution: 25000.0,
      taxableAmount: 25000.0,
      taxableAmountNotDetermined: false,
      totalDistribution: true,
      capitalGain: null,
      federalIncomeTaxWithheld: 5000.0,
      distributionCodes: '7',
      iraSepSimple: true,
      stateTaxInfo: [],
      localTaxInfo: [],
      taxYear: 2024,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099RData(validData)).toBe(true)
  })

  it('returns false for missing grossDistribution', () => {
    const invalidData = {
      payerName: 'Fidelity',
      recipientTIN: '123-45-6789',
      taxableAmountNotDetermined: false,
      totalDistribution: true,
      iraSepSimple: true,
      stateTaxInfo: [],
      localTaxInfo: [],
      corrected: false,
    }

    expect(validate1099RData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean iraSepSimple', () => {
    const invalidData = {
      payerName: 'Fidelity',
      recipientTIN: '123-45-6789',
      grossDistribution: 25000,
      taxableAmountNotDetermined: false,
      totalDistribution: true,
      iraSepSimple: 'true',
      stateTaxInfo: [],
      localTaxInfo: [],
      corrected: false,
    }

    expect(validate1099RData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099RData(null)).toBe(false)
  })
})
