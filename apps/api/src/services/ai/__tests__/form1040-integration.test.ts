/**
 * Form 1040 Integration Tests
 * Validates Form 1040 OCR extraction implementation
 * Updated for CPA-ready data fields (Phase 5 & 6)
 */
import { describe, it, expect } from 'vitest'
import {
  supportsOcrExtraction,
  getOcrPromptForDocType,
  validateExtractedData,
  getFieldLabels,
  type OcrDocType,
} from '../prompts/ocr'
import type {
  Form1040ExtractedData,
  TaxpayerAddress,
  DependentInfo,
} from '../prompts/ocr/form-1040'

describe('Form 1040 OCR Extraction - CPA Enhancement', () => {
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

  describe('CPA Fields - TaxpayerAddress Tests', () => {
    it('validates data with complete TaxpayerAddress', () => {
      const dataWithAddress: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Single',
        taxpayerName: 'John Doe',
        taxpayerSSN: 'XXX-XX-1234',
        spouseName: null,
        spouseSSN: null,
        taxpayerAddress: {
          street: '123 Main St',
          aptNo: 'Apt 4B',
          city: 'Houston',
          state: 'TX',
          zip: '77001',
          country: null,
        },
        dependents: [],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: false,
        qualifyingSurvivingSpouseYear: null,
        totalWages: 50000,
        totalIncome: 50000,
        adjustedGrossIncome: 50000,
        standardOrItemizedDeduction: 13850,
        taxableIncome: 36150,
        totalTax: 4100,
        childTaxCredit: null,
        earnedIncomeCredit: null,
        totalWithheld: 5000,
        totalPayments: 5000,
        refundAmount: 900,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithAddress)).toBe(true)
    })

    it('validates data with null TaxpayerAddress', () => {
      const dataWithNullAddress = {
        taxYear: 2023,
        taxpayerAddress: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithNullAddress)).toBe(true)
    })

    it('validates data with partial TaxpayerAddress', () => {
      const dataWithPartialAddress: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Single',
        taxpayerName: 'Jane Doe',
        taxpayerSSN: 'XXX-XX-5678',
        spouseName: null,
        spouseSSN: null,
        taxpayerAddress: {
          street: '456 Oak Ave',
          aptNo: null,
          city: 'Dallas',
          state: 'TX',
          zip: null,
          country: null,
        },
        dependents: [],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: null,
        qualifyingSurvivingSpouseYear: null,
        totalWages: 75000,
        totalIncome: 75000,
        adjustedGrossIncome: 75000,
        standardOrItemizedDeduction: 13850,
        taxableIncome: 61150,
        totalTax: 8500,
        childTaxCredit: null,
        earnedIncomeCredit: null,
        totalWithheld: 9000,
        totalPayments: 9000,
        refundAmount: 500,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithPartialAddress)).toBe(true)
    })

    it('rejects invalid TaxpayerAddress type', () => {
      const dataWithInvalidAddress = {
        taxYear: 2023,
        taxpayerAddress: 'invalid string address',
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithInvalidAddress)).toBe(false)
    })
  })

  describe('CPA Fields - DependentInfo Tests', () => {
    it('validates data with single dependent', () => {
      const dataWithDependent: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Head of household',
        taxpayerName: 'Parent Doe',
        taxpayerSSN: 'XXX-XX-1234',
        spouseName: null,
        spouseSSN: null,
        taxpayerAddress: null,
        dependents: [
          {
            firstName: 'Child',
            lastName: 'Doe',
            ssn: 'XXX-XX-9999',
            relationship: 'Son',
            childTaxCreditEligible: true,
            creditForOtherDependents: false,
          },
        ],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: false,
        qualifyingSurvivingSpouseYear: null,
        totalWages: 60000,
        totalIncome: 60000,
        adjustedGrossIncome: 60000,
        standardOrItemizedDeduction: 20800,
        taxableIncome: 39200,
        totalTax: 4200,
        childTaxCredit: 2000,
        earnedIncomeCredit: null,
        totalWithheld: 6500,
        totalPayments: 6500,
        refundAmount: 2300,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithDependent)).toBe(true)
      expect(dataWithDependent.dependents.length).toBe(1)
      expect(dataWithDependent.dependents[0].childTaxCreditEligible).toBe(true)
    })

    it('validates data with multiple dependents', () => {
      const dataWithMultipleDependents: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Married filing jointly',
        taxpayerName: 'John Doe',
        taxpayerSSN: 'XXX-XX-1234',
        spouseName: 'Jane Doe',
        spouseSSN: 'XXX-XX-5678',
        taxpayerAddress: null,
        dependents: [
          {
            firstName: 'Child1',
            lastName: 'Doe',
            ssn: 'XXX-XX-0001',
            relationship: 'Daughter',
            childTaxCreditEligible: true,
            creditForOtherDependents: false,
          },
          {
            firstName: 'Child2',
            lastName: 'Doe',
            ssn: 'XXX-XX-0002',
            relationship: 'Son',
            childTaxCreditEligible: true,
            creditForOtherDependents: false,
          },
          {
            firstName: 'Parent',
            lastName: 'Smith',
            ssn: 'XXX-XX-0003',
            relationship: 'Parent',
            childTaxCreditEligible: false,
            creditForOtherDependents: true,
          },
        ],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: false,
        qualifyingSurvivingSpouseYear: null,
        totalWages: 120000,
        totalIncome: 120000,
        adjustedGrossIncome: 120000,
        standardOrItemizedDeduction: 27700,
        taxableIncome: 92300,
        totalTax: 12000,
        childTaxCredit: 4500,
        earnedIncomeCredit: null,
        totalWithheld: 15000,
        totalPayments: 15000,
        refundAmount: 3000,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithMultipleDependents)).toBe(true)
      expect(dataWithMultipleDependents.dependents.length).toBe(3)
    })

    it('validates data with empty dependents array', () => {
      const dataWithNoDependent = {
        taxYear: 2023,
        dependents: [],
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithNoDependent)).toBe(true)
    })

    it('rejects invalid dependents type', () => {
      const dataWithInvalidDependents = {
        taxYear: 2023,
        dependents: 'not an array',
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithInvalidDependents)).toBe(false)
    })
  })

  describe('CPA Fields - Other Fields Tests', () => {
    it('validates data with digitalAssetsAnswer true', () => {
      const dataWithDigitalAssets = {
        taxYear: 2023,
        digitalAssetsAnswer: true,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithDigitalAssets)).toBe(true)
    })

    it('validates data with digitalAssetsAnswer false', () => {
      const dataWithNoDigitalAssets = {
        taxYear: 2023,
        digitalAssetsAnswer: false,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithNoDigitalAssets)).toBe(true)
    })

    it('validates data with digitalAssetsAnswer null (unclear checkbox)', () => {
      const dataWithUnclearDigitalAssets = {
        taxYear: 2023,
        digitalAssetsAnswer: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithUnclearDigitalAssets)).toBe(true)
    })

    it('validates data with adjustmentsToIncome', () => {
      const dataWithAdjustments = {
        taxYear: 2023,
        adjustmentsToIncome: 5000,
        attachedSchedules: ['1'],
      }

      expect(validateExtractedData('FORM_1040', dataWithAdjustments)).toBe(true)
    })

    it('validates data with qualifyingSurvivingSpouseYear', () => {
      const dataWithQSS: Form1040ExtractedData = {
        taxYear: 2023,
        formVariant: '1040',
        filingStatus: 'Qualifying surviving spouse',
        taxpayerName: 'Widow Doe',
        taxpayerSSN: 'XXX-XX-1234',
        spouseName: null,
        spouseSSN: null,
        taxpayerAddress: null,
        dependents: [
          {
            firstName: 'Child',
            lastName: 'Doe',
            ssn: 'XXX-XX-9999',
            relationship: 'Son',
            childTaxCreditEligible: true,
            creditForOtherDependents: false,
          },
        ],
        adjustmentsToIncome: null,
        digitalAssetsAnswer: false,
        qualifyingSurvivingSpouseYear: 2022,
        totalWages: 70000,
        totalIncome: 70000,
        adjustedGrossIncome: 70000,
        standardOrItemizedDeduction: 27700,
        taxableIncome: 42300,
        totalTax: 4800,
        childTaxCredit: 2000,
        earnedIncomeCredit: null,
        totalWithheld: 7500,
        totalPayments: 7500,
        refundAmount: 2700,
        amountOwed: null,
        attachedSchedules: [],
      }

      expect(validateExtractedData('FORM_1040', dataWithQSS)).toBe(true)
      expect(dataWithQSS.qualifyingSurvivingSpouseYear).toBe(2022)
    })

    it('validates data with attached schedules', () => {
      const dataWithSchedules = {
        taxYear: 2023,
        attachedSchedules: ['1', 'C', 'SE'],
      }

      expect(validateExtractedData('FORM_1040', dataWithSchedules)).toBe(true)
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

    it('Field labels include CPA fields', () => {
      const labels = getFieldLabels('FORM_1040')
      // Main CPA fields
      expect(labels['taxpayerAddress']).toBeDefined()
      expect(labels['dependents']).toBeDefined()
      expect(labels['adjustmentsToIncome']).toBeDefined()
      expect(labels['digitalAssetsAnswer']).toBeDefined()
      expect(labels['qualifyingSurvivingSpouseYear']).toBeDefined()
    })

    it('Field labels include nested TaxpayerAddress fields', () => {
      const labels = getFieldLabels('FORM_1040')
      expect(labels['taxpayerAddress.street']).toBeDefined()
      expect(labels['taxpayerAddress.aptNo']).toBeDefined()
      expect(labels['taxpayerAddress.city']).toBeDefined()
      expect(labels['taxpayerAddress.state']).toBeDefined()
      expect(labels['taxpayerAddress.zip']).toBeDefined()
      expect(labels['taxpayerAddress.country']).toBeDefined()
    })

    it('Field labels include nested DependentInfo fields', () => {
      const labels = getFieldLabels('FORM_1040')
      expect(labels['dependents.firstName']).toBeDefined()
      expect(labels['dependents.lastName']).toBeDefined()
      expect(labels['dependents.ssn']).toBeDefined()
      expect(labels['dependents.relationship']).toBeDefined()
      expect(labels['dependents.childTaxCreditEligible']).toBeDefined()
      expect(labels['dependents.creditForOtherDependents']).toBeDefined()
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
