/**
 * OCR Prompt Performance Benchmarks
 * Verifies prompt retrieval is fast enough for production use
 */
import { describe, it, expect } from 'vitest'
import { getOcrPromptForDocType, getFieldLabels } from '../index'

describe('Performance Benchmarks', () => {
  it('retrieves prompts in under 5ms each', () => {
    const docTypes = [
      'W2', 'FORM_1099_B', 'SCHEDULE_A', 'PAY_STUB',
      'FORM_8949', 'SCHEDULE_K1_1065', 'STATE_TAX_RETURN',
      'CLOSING_DISCLOSURE', 'FORM_8938', 'CRYPTO_TAX_REPORT',
    ]

    for (const docType of docTypes) {
      const start = performance.now()
      getOcrPromptForDocType(docType)
      const elapsed = performance.now() - start

      expect(elapsed, `Prompt for ${docType} took ${elapsed}ms`).toBeLessThan(5)
    }
  })

  it('handles 1000 prompt lookups in under 100ms', () => {
    const docTypes = [
      'W2', 'FORM_1099_B', 'SCHEDULE_A', 'PAY_STUB', 'UNKNOWN',
      'FORM_8949', 'SCHEDULE_K1_1065', 'STATE_TAX_RETURN',
      'CLOSING_DISCLOSURE', 'FORM_8938',
    ]

    const start = performance.now()
    for (let i = 0; i < 1000; i++) {
      getOcrPromptForDocType(docTypes[i % docTypes.length])
    }
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(100)
  })

  it('retrieves labels in under 5ms each', () => {
    const docTypes = [
      'W2', 'FORM_1099_INT', 'SCHEDULE_C', 'ITIN_LETTER',
      'FORM_2441', 'PENSION_STATEMENT',
    ]

    for (const docType of docTypes) {
      const start = performance.now()
      getFieldLabels(docType)
      const elapsed = performance.now() - start

      expect(elapsed, `Labels for ${docType} took ${elapsed}ms`).toBeLessThan(5)
    }
  })

  it('generic fallback prompt is under 5ms', () => {
    const start = performance.now()
    getOcrPromptForDocType('TOTALLY_UNKNOWN_DOCUMENT_TYPE')
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(5)
  })

  it('prompts are deterministic (same input = same output)', () => {
    const docTypes = ['W2', 'FORM_1099_B', 'PAY_STUB', 'UNKNOWN']

    for (const docType of docTypes) {
      const prompt1 = getOcrPromptForDocType(docType)
      const prompt2 = getOcrPromptForDocType(docType)
      expect(prompt1).toBe(prompt2)
    }
  })
})
