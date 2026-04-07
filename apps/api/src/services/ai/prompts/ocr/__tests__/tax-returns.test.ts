/**
 * Tax Return Variants Unit Tests (Phase 7)
 * Tests for 4 tax return OCR extraction prompts
 * Covers: 1040-SR, 1040-NR, 1040-X, State Tax Return
 */
import { describe, it, expect } from 'vitest'

import { getForm1040SRExtractionPrompt, validateForm1040SRData, FORM_1040_SR_FIELD_LABELS_VI } from '../form-1040-sr'
import { getForm1040NRExtractionPrompt, validateForm1040NRData, FORM_1040_NR_FIELD_LABELS_VI } from '../form-1040-nr'
import { getForm1040XExtractionPrompt, validateForm1040XData, FORM_1040_X_FIELD_LABELS_VI } from '../form-1040-x'
import { getStateTaxReturnExtractionPrompt, validateStateTaxReturnData, STATE_TAX_RETURN_FIELD_LABELS_VI } from '../state-tax-return'

const forms = [
  {
    name: 'Form 1040-SR',
    prompt: getForm1040SRExtractionPrompt,
    validate: validateForm1040SRData,
    labels: FORM_1040_SR_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      spouseName: null, spouseSSN: null,
      filingStatus: 'MARRIED_FILING_JOINTLY',
      adjustedGrossIncome: 60200, taxableIncome: 32200,
      totalTax: 3564, totalPayments: 5000,
      refundAmount: 1436, amountOwed: null,
      dependents: [], attachedSchedules: [],
      taxYear: 2024,
    },
    requiredNumericFields: ['adjustedGrossIncome'],
    arrayFields: ['attachedSchedules'],
    // 1040-SR requires attachedSchedules array, so empty object fails
    rejectsEmptyObject: true,
  },
  {
    name: 'Form 1040-NR',
    prompt: getForm1040NRExtractionPrompt,
    validate: validateForm1040NRData,
    labels: FORM_1040_NR_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'Jan Mueller', taxpayerSSN: null,
      countryOfResidence: 'Germany', visaType: 'F-1',
      adjustedGrossIncome: 40000, taxableIncome: 26700,
      totalTax: 2964, totalPayments: 4000,
      refundAmount: 1036, amountOwed: null,
      taxYear: 2024,
    },
    requiredNumericFields: ['adjustedGrossIncome'],
    // OR-based validation: undefined !== null is true, so empty object passes
    rejectsEmptyObject: false,
  },
  {
    name: 'Form 1040-X',
    prompt: getForm1040XExtractionPrompt,
    validate: validateForm1040XData,
    labels: FORM_1040_X_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      taxYear: 2023, agiOriginal: 85000, agiCorrected: 88000,
      taxableIncomeOriginal: null, taxableIncomeCorrected: null,
      additionalRefundDue: 750, additionalTaxOwed: null,
      explanationOfChanges: 'Received corrected 1099-INT',
    },
    requiredNumericFields: ['agiCorrected'],
    rejectsEmptyObject: false,
  },
  {
    name: 'State Tax Return',
    prompt: getStateTaxReturnExtractionPrompt,
    validate: validateStateTaxReturnData,
    labels: STATE_TAX_RETURN_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      stateName: 'California', stateAGI: 86500,
      stateTaxableIncome: 72000, stateTax: 4320,
      stateWithheld: 5000, stateRefund: 680,
      stateAmountOwed: null, taxYear: 2024,
    },
    requiredNumericFields: ['stateAGI'],
    rejectsEmptyObject: false,
  },
]

// Prompt Generation
describe('Tax Returns - Prompt Generation', () => {
  forms.forEach(({ name, prompt }) => {
    it(`${name}: returns non-empty string with JSON and rules`, () => {
      const result = prompt()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(100)
      expect(result).toContain('JSON')
      expect(result).toContain('Rules')
    })
  })
})

// Validation - Reject invalid primitive inputs
describe('Tax Returns - Validation Rejects Primitives', () => {
  forms.forEach(({ name, validate }) => {
    it(`${name}: rejects null and undefined`, () => {
      expect(validate(null)).toBe(false)
      expect(validate(undefined)).toBe(false)
    })

    it(`${name}: rejects non-object primitives`, () => {
      expect(validate('string')).toBe(false)
      expect(validate(123)).toBe(false)
    })
  })
})

// Validation - Reject empty objects (only for forms that check required fields)
describe('Tax Returns - Validation Rejects Empty Object', () => {
  forms
    .filter((f) => f.rejectsEmptyObject)
    .forEach(({ name, validate }) => {
      it(`${name}: rejects empty object`, () => {
        expect(validate({})).toBe(false)
      })
    })
})

// Validation - Accept valid data
describe('Tax Returns - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - Reject wrong numeric types
describe('Tax Returns - Validation Rejects Wrong Numeric Types', () => {
  forms.forEach(({ name, validate, validData, requiredNumericFields }) => {
    requiredNumericFields.forEach((field) => {
      it(`${name}: rejects non-number '${field}'`, () => {
        const bad = { ...validData, [field]: 'not-a-number' }
        expect(validate(bad)).toBe(false)
      })
    })
  })
})

// Validation - Reject non-array fields
describe('Tax Returns - Validation Rejects Missing Arrays', () => {
  forms
    .filter((f) => f.arrayFields && f.arrayFields.length > 0)
    .forEach(({ name, validate, validData, arrayFields }) => {
      arrayFields!.forEach((field) => {
        it(`${name}: rejects non-array '${field}'`, () => {
          const bad = { ...validData, [field]: 'not-an-array' }
          expect(validate(bad)).toBe(false)
        })
      })
    })
})

// Validation - OR-based validators accept data with at least one key field
describe('Tax Returns - OR-Based Validation', () => {
  it('Form 1040-NR: accepts data with only taxYear', () => {
    expect(validateForm1040NRData({ taxYear: 2024 })).toBe(true)
  })

  it('Form 1040-X: accepts data with only taxYear', () => {
    expect(validateForm1040XData({ taxYear: 2024 })).toBe(true)
  })

  it('State Tax Return: accepts data with only stateAGI', () => {
    expect(validateStateTaxReturnData({ stateAGI: 50000 })).toBe(true)
  })

  it('Form 1040-NR: rejects data with all key fields explicitly null', () => {
    expect(validateForm1040NRData({
      taxYear: null, adjustedGrossIncome: null, totalTax: null, refundAmount: null,
    })).toBe(false)
  })
})

// Vietnamese Labels
describe('Tax Returns - Vietnamese Labels', () => {
  forms.forEach(({ name, labels }) => {
    it(`${name}: has non-empty Vietnamese labels`, () => {
      const keys = Object.keys(labels)
      expect(keys.length).toBeGreaterThan(0)
      for (const [key, value] of Object.entries(labels)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
        expect(value).not.toBe(key)
      }
    })
  })
})
