/**
 * Form 1040 Integration Tests
 * Validates Form 1040 OCR extraction implementation in Phase 3
 */
import { describe, it, expect } from 'vitest'
import {
  supportsOcrExtraction,
  getOcrPromptForDocType,
  validateExtractedData,
  getFieldLabels,
  type OcrDocType,
} from '../prompts/ocr'
import type { Form1040ExtractedData } from '../prompts/ocr/form-1040'

describe('Form 1040 OCR Extraction - Phase 3', () => {
  describe('Configuration Tests', () => {
    it('supportsOcrExtraction returns true for FORM_1040', () => {
      expect(supportsOcrExtraction('FORM_1040')).toBe(true)
    })

    it('supportsOcrExtraction returns false for unsupported types', () => {
      expect(supportsOcrExtraction('UNKNOWN_TYPE')).toBe(false)
      expect(supportsOcrExtraction('FORM_1040_INVALID')).toBe(false)
    })

    it('getOcrPromptForDocType returns non-null string for FORM_1040', () => {
      const prompt = getOcrPromptForDocType('FORM_1040')
      expect(prompt).not.toBeNull()
      expect(typeof prompt).toBe('string')
      expect(prompt!.length).toBeGreaterThan(100)
    })

    it('OCR prompt for FORM_1040 contains key instructions', () => {
      const prompt = getOcrPromptForDocType('FORM_1040')
      expect(prompt).toContain('Form 1040')
      expect(prompt).toContain('Tax year')
      expect(prompt).toContain('JSON')
    })
  })

  describe('Validation Tests', () => {
    it('validateExtractedData returns true for valid Form 1040 data', () => {
      const validData: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Single',
        taxpayerName: 'John Doe',
        taxpayerSSN: 'XXX-XX-1234',
        spouseName: null,
        spouseSSN: null,
        // New CPA fields (Phase 1)
        taxpayerAddress: {
          street: '123 Main St',
          aptNo: null,
          city: 'San Jose',
          state: 'CA',
          zip: '95134',
          country: null,
        },
        dependents: [],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: false,
        qualifyingSurvivingSpouseYear: null,
        // Income fields
        totalWages: 85000,
        totalIncome: 92000,
        adjustedGrossIncome: 88000,
        standardOrItemizedDeduction: 27700,
        taxableIncome: 60300,
        totalTax: 7200,
        childTaxCredit: 2000,
        earnedIncomeCredit: null,
        totalWithheld: 8500,
        totalPayments: 8500,
        refundAmount: 1300,
        amountOwed: null,
        attachedSchedules: ['C', 'SE'],
      }

      expect(validateExtractedData('FORM_1040', validData)).toBe(true)
    })

    it('validateExtractedData returns true when at least one key field is non-null', () => {
      const minimalData = {
        taxYear: 2023,
        formVariant: null,
        filingStatus: null,
        taxpayerName: null,
        taxpayerSSN: null,
        spouseName: null,
        spouseSSN: null,
        totalWages: null,
        totalIncome: null,
        adjustedGrossIncome: null,
        standardOrItemizedDeduction: null,
        taxableIncome: null,
        totalTax: null,
        childTaxCredit: null,
        earnedIncomeCredit: null,
        totalWithheld: null,
        totalPayments: null,
        refundAmount: null,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', minimalData)).toBe(true)
    })

    it('validateExtractedData returns false for invalid data', () => {
      // Missing attachedSchedules (required to be array)
      const invalidData = {
        taxYear: null,
        adjustedGrossIncome: null,
        totalTax: null,
        refundAmount: null,
        attachedSchedules: 'not_an_array', // Should be array
      }

      expect(validateExtractedData('FORM_1040', invalidData)).toBe(false)
    })

    it('validateExtractedData returns false for null input', () => {
      expect(validateExtractedData('FORM_1040', null)).toBe(false)
      expect(validateExtractedData('FORM_1040', undefined)).toBe(false)
    })

    it('validateExtractedData returns false when all key fields are null', () => {
      const emptyData = {
        taxYear: null,
        formVariant: null,
        filingStatus: null,
        taxpayerName: null,
        taxpayerSSN: null,
        spouseName: null,
        spouseSSN: null,
        totalWages: null,
        totalIncome: null,
        adjustedGrossIncome: null,
        standardOrItemizedDeduction: null,
        taxableIncome: null,
        totalTax: null,
        childTaxCredit: null,
        earnedIncomeCredit: null,
        totalWithheld: null,
        totalPayments: null,
        refundAmount: null,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', emptyData)).toBe(false)
    })
  })

  describe('Field Labels Tests', () => {
    it('getFieldLabels returns Vietnamese labels for FORM_1040', () => {
      const labels = getFieldLabels('FORM_1040')
      expect(Object.keys(labels).length).toBeGreaterThan(0)
    })

    it('Field labels include key Form 1040 fields', () => {
      const labels = getFieldLabels('FORM_1040')
      expect(labels['taxYear']).toBeDefined()
      expect(labels['adjustedGrossIncome']).toBeDefined()
      expect(labels['totalTax']).toBeDefined()
      expect(labels['refundAmount']).toBeDefined()
      expect(labels['taxpayerSSN']).toBeDefined()
    })

    it('Field labels are in Vietnamese', () => {
      const labels = getFieldLabels('FORM_1040')
      const labelValues = Object.values(labels).join(' ')
      // Check for Vietnamese characters or common Vietnamese terms
      expect(
        labelValues.includes('Năm') || labelValues.includes('Thuế') || labelValues.includes('Tên')
      ).toBe(true)
    })
  })

  describe('Type Union Tests', () => {
    it('FORM_1040 is included in OcrDocType union', () => {
      const docType: OcrDocType = 'FORM_1040'
      expect(docType).toBe('FORM_1040')
      expect(supportsOcrExtraction(docType)).toBe(true)
    })
  })

  describe('Consistency Tests', () => {
    it('All supported doc types have prompts', () => {
      const supportedTypes: OcrDocType[] = [
        'W2',
        'FORM_1099_INT',
        'FORM_1099_NEC',
        'FORM_1099_K',
        'FORM_1099_DIV',
        'FORM_1099_R',
        'FORM_1099_SSA',
        'FORM_1099_G',
        'FORM_1099_MISC',
        'FORM_1098',
        'FORM_1098_T',
        'FORM_1095_A',
        'SCHEDULE_K1',
        'BANK_STATEMENT',
        'SSN_CARD',
        'DRIVER_LICENSE',
        'FORM_1040',
      ]

      for (const docType of supportedTypes) {
        const prompt = getOcrPromptForDocType(docType)
        expect(prompt, `No prompt for ${docType}`).not.toBeNull()
        expect(prompt!.length).toBeGreaterThan(100)
      }
    })

    it('All supported doc types have validators', () => {
      const supportedTypes: OcrDocType[] = [
        'W2',
        'FORM_1099_INT',
        'FORM_1099_NEC',
        'FORM_1099_K',
        'FORM_1099_DIV',
        'FORM_1099_R',
        'FORM_1099_SSA',
        'FORM_1099_G',
        'FORM_1099_MISC',
        'FORM_1098',
        'FORM_1098_T',
        'FORM_1095_A',
        'SCHEDULE_K1',
        'BANK_STATEMENT',
        'SSN_CARD',
        'DRIVER_LICENSE',
        'FORM_1040',
      ]

      for (const docType of supportedTypes) {
        // Test that validator doesn't throw
        expect(() => validateExtractedData(docType, {})).not.toThrow()
      }
    })

    it('All supported doc types have field labels', () => {
      const supportedTypes: OcrDocType[] = [
        'W2',
        'FORM_1099_INT',
        'FORM_1099_NEC',
        'FORM_1099_K',
        'FORM_1099_DIV',
        'FORM_1099_R',
        'FORM_1099_SSA',
        'FORM_1099_G',
        'FORM_1099_MISC',
        'FORM_1098',
        'FORM_1098_T',
        'FORM_1095_A',
        'SCHEDULE_K1',
        'BANK_STATEMENT',
        'SSN_CARD',
        'DRIVER_LICENSE',
        'FORM_1040',
      ]

      for (const docType of supportedTypes) {
        const labels = getFieldLabels(docType)
        expect(Object.keys(labels).length).toBeGreaterThan(0)
      }
    })
  })
})
