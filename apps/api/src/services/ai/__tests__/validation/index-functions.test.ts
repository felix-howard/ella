/**
 * Validation Tests: Index Functions
 * Tests for the OCR prompts index module functions
 */
import { describe, it, expect } from 'vitest'
import {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
} from '../../prompts/ocr'

const SUPPORTED_OCR_TYPES = [
  'W2', 'FORM_1099_INT', 'FORM_1099_NEC', 'FORM_1099_K',
  'FORM_1099_DIV', 'FORM_1099_R', 'FORM_1099_SSA', 'FORM_1099_G',
  'FORM_1099_MISC', 'FORM_1098', 'FORM_1098_T', 'FORM_1095_A',
  'SCHEDULE_K1', 'BANK_STATEMENT', 'CREDIT_CARD_STATEMENT', 'SSN_CARD', 'DRIVER_LICENSE',
]

// =============================================================================
// getOcrPromptForDocType TESTS
// =============================================================================
describe('getOcrPromptForDocType', () => {
  it('returns prompt for all supported doc types', () => {
    for (const docType of SUPPORTED_OCR_TYPES) {
      const prompt = getOcrPromptForDocType(docType)
      expect(prompt).not.toBeNull()
      expect(typeof prompt).toBe('string')
      expect(prompt!.length).toBeGreaterThan(100)
    }
  })

  it('returns generic prompt for unknown doc types (fallback)', () => {
    const prompt = getOcrPromptForDocType('UNKNOWN')
    expect(prompt).not.toBeNull()
    expect(typeof prompt).toBe('string')
    expect(prompt!.length).toBeGreaterThan(100)
  })
})

// =============================================================================
// supportsOcrExtraction TESTS
// =============================================================================
describe('supportsOcrExtraction', () => {
  it('returns true for all OCR-supported types', () => {
    for (const docType of SUPPORTED_OCR_TYPES) {
      expect(supportsOcrExtraction(docType)).toBe(true)
    }
  })

  it('returns true for all types (generic fallback handles everything)', () => {
    // With generic fallback extractor, all types are supported
    expect(supportsOcrExtraction('UNKNOWN')).toBe(true)
    expect(supportsOcrExtraction('PASSPORT')).toBe(true)
    expect(supportsOcrExtraction('RECEIPT')).toBe(true)
    expect(supportsOcrExtraction('OTHER')).toBe(true)
    expect(supportsOcrExtraction('BUSINESS_LICENSE')).toBe(true)
  })
})

// =============================================================================
// validateExtractedData TESTS
// =============================================================================
describe('validateExtractedData', () => {
  it('validates W2 data correctly', () => {
    const validW2 = {
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      employeeSSN: '123-45-6789',
      employeeName: 'John Doe',
      wagesTipsOther: 50000,
      federalIncomeTaxWithheld: 5000,
      stateTaxInfo: [],
      localTaxInfo: [],
      box12Codes: [],
      box13Flags: { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false },
    }

    expect(validateExtractedData('W2', validW2)).toBe(true)
    expect(validateExtractedData('W2', {})).toBe(false)
  })

  it('validates 1099-K data correctly', () => {
    const valid1099K = {
      filerName: 'Square',
      payeeName: 'Test',
      payeeTIN: '123456789',
      grossAmount: 50000,
      stateTaxInfo: [],
      monthlyAmounts: {},
      corrected: false,
    }

    expect(validateExtractedData('FORM_1099_K', valid1099K)).toBe(true)
  })

  it('validates credit card statement data correctly', () => {
    const validCreditCardStatement = {
      issuerName: 'Chase',
      accountHolderName: 'ABC Nail Salon LLC',
      accountNumber: '****1234',
      statementPeriodStart: '01/01/2024',
      statementPeriodEnd: '01/31/2024',
      previousBalance: 1200,
      payments: 1000,
      purchases: 2450.75,
      credits: 125,
      fees: 39,
      interestCharged: 18.42,
      endingBalance: 2583.17,
      minimumPaymentDue: 75,
      paymentDueDate: '02/25/2024',
      creditLimit: 10000,
    }

    expect(validateExtractedData('CREDIT_CARD_STATEMENT', validCreditCardStatement)).toBe(true)
    expect(validateExtractedData('CREDIT_CARD_STATEMENT', {})).toBe(false)
  })

  it('rejects unmasked or malformed credit card statement data', () => {
    const validBase = {
      issuerName: 'Chase',
      accountHolderName: 'ABC Nail Salon LLC',
      accountNumber: '****1234',
      statementPeriodStart: '01/01/2024',
      statementPeriodEnd: '01/31/2024',
      previousBalance: 1200,
      payments: 1000,
      purchases: 2450.75,
      credits: 125,
      fees: 39,
      interestCharged: 18.42,
      endingBalance: 2583.17,
      minimumPaymentDue: 75,
      paymentDueDate: '02/25/2024',
      creditLimit: 10000,
    }

    expect(validateExtractedData('CREDIT_CARD_STATEMENT', {
      ...validBase,
      accountNumber: '4111111111111234',
    })).toBe(false)
    expect(validateExtractedData('CREDIT_CARD_STATEMENT', {
      ...validBase,
      accountNumber: 4111111111111234,
    })).toBe(false)
    expect(validateExtractedData('CREDIT_CARD_STATEMENT', {
      ...validBase,
      issuerName: ['Chase'],
    })).toBe(false)
    expect(validateExtractedData('CREDIT_CARD_STATEMENT', {
      ...validBase,
      endingBalance: Number.NaN,
    })).toBe(false)
  })

  it('validates with generic fallback for unknown doc types', () => {
    // Generic validator requires documentType + non-empty extractedFields
    const validGeneric = {
      documentType: 'UNKNOWN',
      extractedFields: [{ fieldName: 'test', fieldValue: 'val', fieldType: 'text' }],
      rawText: null,
      taxRelevanceNotes: null,
      extractedAt: new Date().toISOString(),
    }
    expect(validateExtractedData('UNKNOWN', validGeneric)).toBe(true)
    // Empty/invalid data fails generic validation
    expect(validateExtractedData('INVALID', {})).toBe(false)
  })
})

// =============================================================================
// getFieldLabels TESTS
// =============================================================================
describe('getFieldLabels', () => {
  it('returns Vietnamese labels for all supported types', () => {
    for (const docType of SUPPORTED_OCR_TYPES) {
      const labels = getFieldLabels(docType)
      expect(labels).toBeDefined()
      expect(typeof labels).toBe('object')
      expect(Object.keys(labels).length).toBeGreaterThan(0)
    }
  })

  it('returns generic labels for unknown type', () => {
    const labels = getFieldLabels('UNKNOWN')
    expect(labels).toBeDefined()
    expect(typeof labels).toBe('object')
    expect(Object.keys(labels).length).toBeGreaterThan(0)
  })
})
