/**
 * Classification Prompt Unit Tests
 * Tests for classification prompt generation and result validation
 * Phase 5: Comprehensive testing
 */
import { describe, it, expect } from 'vitest'
import {
  getClassificationPrompt,
  validateClassificationResult,
  SUPPORTED_DOC_TYPES,
} from '../prompts/classify'

// =============================================================================
// CLASSIFICATION PROMPT GENERATION TESTS
// =============================================================================
describe('getClassificationPrompt', () => {
  const prompt = getClassificationPrompt()

  describe('few-shot examples', () => {
    it('includes W-2 form example', () => {
      expect(prompt).toContain('EXAMPLE 1')
      expect(prompt).toContain('W-2 Form')
      expect(prompt).toContain('Wage and Tax Statement')
    })

    it('includes SSN card example', () => {
      expect(prompt).toContain('EXAMPLE 2')
      expect(prompt).toContain('Social Security Card')
    })

    it('includes 1099-K payment card example', () => {
      expect(prompt).toContain('EXAMPLE 3')
      expect(prompt).toContain('1099-K')
      expect(prompt).toContain('Square')
    })

    it('includes 1099-INT interest example', () => {
      expect(prompt).toContain('EXAMPLE 4')
      expect(prompt).toContain('1099-INT')
    })

    it('includes 1099-NEC contractor example', () => {
      expect(prompt).toContain('EXAMPLE 5')
      expect(prompt).toContain('1099-NEC')
    })

    it('includes Driver License example', () => {
      expect(prompt).toContain('EXAMPLE 6')
      expect(prompt).toContain('Driver')
    })
  })

  describe('Vietnamese name handling', () => {
    it('includes Vietnamese name handling section', () => {
      expect(prompt).toContain('VIETNAMESE NAME HANDLING')
    })

    it('mentions common Vietnamese family names', () => {
      expect(prompt).toContain('Nguyen')
      expect(prompt).toContain('Tran')
      expect(prompt).toContain('Le')
      expect(prompt).toContain('Pham')
    })

    it('explains Vietnamese name order', () => {
      expect(prompt).toContain('family name FIRST')
    })
  })

  describe('confidence calibration', () => {
    it('includes confidence calibration section', () => {
      expect(prompt).toContain('CONFIDENCE CALIBRATION')
    })

    it('defines high confidence range', () => {
      expect(prompt).toContain('HIGH CONFIDENCE')
      expect(prompt).toContain('0.85-0.95')
    })

    it('defines medium confidence range', () => {
      expect(prompt).toContain('MEDIUM CONFIDENCE')
      expect(prompt).toContain('0.60-0.84')
    })

    it('defines low confidence range', () => {
      expect(prompt).toContain('LOW CONFIDENCE')
      expect(prompt).toContain('< 0.60')
    })

    it('advises against overconfidence', () => {
      expect(prompt).toContain('Never use confidence > 0.95')
    })
  })

  describe('document types', () => {
    it('includes all major document type categories', () => {
      expect(prompt).toContain('IDENTIFICATION DOCUMENTS')
      expect(prompt).toContain('TAX FORMS - INCOME')
      expect(prompt).toContain('TAX FORMS - DEDUCTIONS')
      expect(prompt).toContain('BUSINESS DOCUMENTS')
    })

    it('lists W2 with description', () => {
      expect(prompt).toContain('W2')
      expect(prompt).toContain('Wage and Tax Statement')
    })

    it('lists all 1099 variants', () => {
      expect(prompt).toContain('FORM_1099_INT')
      expect(prompt).toContain('FORM_1099_DIV')
      expect(prompt).toContain('FORM_1099_NEC')
      expect(prompt).toContain('FORM_1099_MISC')
      expect(prompt).toContain('FORM_1099_K')
      expect(prompt).toContain('FORM_1099_R')
      expect(prompt).toContain('FORM_1099_G')
      expect(prompt).toContain('FORM_1099_SSA')
    })

    it('lists ID documents', () => {
      expect(prompt).toContain('SSN_CARD')
      expect(prompt).toContain('DRIVER_LICENSE')
      expect(prompt).toContain('PASSPORT')
    })

    it('lists deduction forms', () => {
      expect(prompt).toContain('FORM_1098')
      expect(prompt).toContain('FORM_1098_T')
      expect(prompt).toContain('FORM_1095_A')
    })

    it('lists business documents', () => {
      expect(prompt).toContain('BANK_STATEMENT')
      expect(prompt).toContain('SCHEDULE_K1')
    })
  })

  describe('JSON response format', () => {
    it('specifies JSON response format', () => {
      expect(prompt).toContain('Respond in JSON format')
    })

    it('includes expected JSON structure', () => {
      expect(prompt).toContain('"docType"')
      expect(prompt).toContain('"confidence"')
      expect(prompt).toContain('"reasoning"')
      expect(prompt).toContain('"alternativeTypes"')
    })
  })

  describe('classification rules', () => {
    it('includes rules section', () => {
      expect(prompt).toContain('RULES')
    })

    it('mentions 1099 variant verification', () => {
      expect(prompt).toContain('For 1099 variants')
      expect(prompt).toContain('verify the specific letter suffix')
    })

    it('mentions CORRECTED checkbox check', () => {
      expect(prompt).toContain('CORRECTED')
    })
  })
})

// =============================================================================
// CLASSIFICATION RESULT VALIDATION TESTS
// =============================================================================
describe('validateClassificationResult', () => {
  describe('valid results', () => {
    it('returns true for valid classification result', () => {
      const result = {
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'Clear W-2 form with visible title and wage boxes',
      }

      expect(validateClassificationResult(result)).toBe(true)
    })

    it('returns true for result with alternativeTypes', () => {
      const result = {
        docType: 'FORM_1099_INT',
        confidence: 0.72,
        reasoning: 'Appears to be 1099-INT form',
        alternativeTypes: [{ docType: 'FORM_1099_DIV', confidence: 0.2 }],
      }

      expect(validateClassificationResult(result)).toBe(true)
    })

    it('returns true for UNKNOWN docType', () => {
      const result = {
        docType: 'UNKNOWN',
        confidence: 0.35,
        reasoning: 'Image too blurry to identify',
      }

      expect(validateClassificationResult(result)).toBe(true)
    })

    it('returns true for confidence at boundaries', () => {
      expect(
        validateClassificationResult({
          docType: 'W2',
          confidence: 0,
          reasoning: 'Test',
        })
      ).toBe(true)

      expect(
        validateClassificationResult({
          docType: 'W2',
          confidence: 1,
          reasoning: 'Test',
        })
      ).toBe(true)
    })

    it('validates all supported document types', () => {
      for (const docType of SUPPORTED_DOC_TYPES) {
        const result = {
          docType,
          confidence: 0.9,
          reasoning: `Valid ${docType} document`,
        }
        expect(validateClassificationResult(result)).toBe(true)
      }
    })
  })

  describe('invalid results', () => {
    it('returns false for invalid docType', () => {
      const result = {
        docType: 'INVALID_TYPE',
        confidence: 0.9,
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for confidence below 0', () => {
      const result = {
        docType: 'W2',
        confidence: -0.1,
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for confidence above 1', () => {
      const result = {
        docType: 'W2',
        confidence: 1.5,
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for missing docType', () => {
      const result = {
        confidence: 0.9,
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for missing confidence', () => {
      const result = {
        docType: 'W2',
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for missing reasoning', () => {
      const result = {
        docType: 'W2',
        confidence: 0.9,
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for non-string docType', () => {
      const result = {
        docType: 123,
        confidence: 0.9,
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for non-number confidence', () => {
      const result = {
        docType: 'W2',
        confidence: '0.9',
        reasoning: 'Test',
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for non-string reasoning', () => {
      const result = {
        docType: 'W2',
        confidence: 0.9,
        reasoning: 123,
      }

      expect(validateClassificationResult(result)).toBe(false)
    })

    it('returns false for null input', () => {
      expect(validateClassificationResult(null)).toBe(false)
    })

    it('returns false for non-object input', () => {
      expect(validateClassificationResult('string')).toBe(false)
      expect(validateClassificationResult(123)).toBe(false)
      expect(validateClassificationResult(undefined)).toBe(false)
    })
  })
})

// =============================================================================
// SUPPORTED_DOC_TYPES TESTS
// =============================================================================
describe('SUPPORTED_DOC_TYPES', () => {
  it('includes all required identification documents', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('SSN_CARD')
    expect(SUPPORTED_DOC_TYPES).toContain('DRIVER_LICENSE')
    expect(SUPPORTED_DOC_TYPES).toContain('PASSPORT')
  })

  it('includes all required income tax forms', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('W2')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_INT')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_DIV')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_NEC')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_MISC')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_K')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_R')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_G')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1099_SSA')
    expect(SUPPORTED_DOC_TYPES).toContain('SCHEDULE_K1')
  })

  it('includes all required deduction forms', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1098')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1098_T')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1095_A')
  })

  it('includes all required business documents', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('BANK_STATEMENT')
    expect(SUPPORTED_DOC_TYPES).toContain('PROFIT_LOSS_STATEMENT')
    expect(SUPPORTED_DOC_TYPES).toContain('BUSINESS_LICENSE')
    expect(SUPPORTED_DOC_TYPES).toContain('EIN_LETTER')
  })

  it('includes other document types', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('RECEIPT')
    expect(SUPPORTED_DOC_TYPES).toContain('BIRTH_CERTIFICATE')
    expect(SUPPORTED_DOC_TYPES).toContain('DAYCARE_RECEIPT')
    expect(SUPPORTED_DOC_TYPES).toContain('OTHER')
  })

  it('includes tax return form types', () => {
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1040')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1040_SR')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1040_NR')
    expect(SUPPORTED_DOC_TYPES).toContain('FORM_1040_X')
    expect(SUPPORTED_DOC_TYPES).toContain('STATE_TAX_RETURN')
    expect(SUPPORTED_DOC_TYPES).toContain('FOREIGN_TAX_RETURN')
    expect(SUPPORTED_DOC_TYPES).toContain('TAX_RETURN_TRANSCRIPT')
  })

  it('has correct total count of document types', () => {
    // Expanded to 71 types: 64 base + 7 tax return types (FORM_1040, _SR, _NR, _X, STATE_TAX_RETURN, FOREIGN_TAX_RETURN, TAX_RETURN_TRANSCRIPT)
    expect(SUPPORTED_DOC_TYPES.length).toBe(71)
  })
})
