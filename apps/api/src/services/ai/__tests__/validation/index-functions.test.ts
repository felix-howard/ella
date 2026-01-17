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

// =============================================================================
// getOcrPromptForDocType TESTS
// =============================================================================
describe('getOcrPromptForDocType', () => {
  it('returns prompt for all supported doc types', () => {
    const supportedTypes = [
      'W2', 'FORM_1099_INT', 'FORM_1099_NEC', 'FORM_1099_K',
      'FORM_1099_DIV', 'FORM_1099_R', 'FORM_1099_SSA', 'FORM_1099_G',
      'FORM_1099_MISC', 'FORM_1098', 'FORM_1098_T', 'FORM_1095_A',
      'SCHEDULE_K1', 'BANK_STATEMENT', 'SSN_CARD', 'DRIVER_LICENSE',
    ]

    for (const docType of supportedTypes) {
      const prompt = getOcrPromptForDocType(docType)
      expect(prompt).not.toBeNull()
      expect(typeof prompt).toBe('string')
      expect(prompt!.length).toBeGreaterThan(100)
    }
  })

  it('returns null for unsupported doc type', () => {
    expect(getOcrPromptForDocType('UNKNOWN')).toBeNull()
    expect(getOcrPromptForDocType('PASSPORT')).toBeNull()
    expect(getOcrPromptForDocType('RECEIPT')).toBeNull()
  })
})

// =============================================================================
// supportsOcrExtraction TESTS
// =============================================================================
describe('supportsOcrExtraction', () => {
  it('returns true for all OCR-supported types', () => {
    const supportedTypes = [
      'W2', 'FORM_1099_INT', 'FORM_1099_NEC', 'FORM_1099_K',
      'FORM_1099_DIV', 'FORM_1099_R', 'FORM_1099_SSA', 'FORM_1099_G',
      'FORM_1099_MISC', 'FORM_1098', 'FORM_1098_T', 'FORM_1095_A',
      'SCHEDULE_K1', 'BANK_STATEMENT', 'SSN_CARD', 'DRIVER_LICENSE',
    ]

    for (const docType of supportedTypes) {
      expect(supportsOcrExtraction(docType)).toBe(true)
    }
  })

  it('returns false for non-OCR-supported types', () => {
    expect(supportsOcrExtraction('UNKNOWN')).toBe(false)
    expect(supportsOcrExtraction('PASSPORT')).toBe(false)
    expect(supportsOcrExtraction('RECEIPT')).toBe(false)
    expect(supportsOcrExtraction('OTHER')).toBe(false)
    expect(supportsOcrExtraction('BUSINESS_LICENSE')).toBe(false)
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

  it('returns false for unknown doc type', () => {
    expect(validateExtractedData('UNKNOWN', {})).toBe(false)
    expect(validateExtractedData('INVALID', {})).toBe(false)
  })
})

// =============================================================================
// getFieldLabels TESTS
// =============================================================================
describe('getFieldLabels', () => {
  it('returns Vietnamese labels for all supported types', () => {
    const supportedTypes = [
      'W2', 'FORM_1099_INT', 'FORM_1099_NEC', 'FORM_1099_K',
      'FORM_1099_DIV', 'FORM_1099_R', 'FORM_1099_SSA', 'FORM_1099_G',
      'FORM_1099_MISC', 'FORM_1098', 'FORM_1098_T', 'FORM_1095_A',
      'SCHEDULE_K1', 'BANK_STATEMENT', 'SSN_CARD', 'DRIVER_LICENSE',
    ]

    for (const docType of supportedTypes) {
      const labels = getFieldLabels(docType)
      expect(labels).toBeDefined()
      expect(typeof labels).toBe('object')
      expect(Object.keys(labels).length).toBeGreaterThan(0)
    }
  })

  it('returns empty object for unknown type', () => {
    const labels = getFieldLabels('UNKNOWN')
    expect(labels).toEqual({})
  })
})
