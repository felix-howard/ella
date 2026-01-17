/**
 * Performance Benchmark Tests for AI Prompts
 * Tests prompt generation performance across all document types
 * Phase 5: Validation and performance testing
 */
import { describe, it, expect, beforeAll } from 'vitest'
import {
  getOcrPromptForDocType,
  supportsOcrExtraction,
  validateExtractedData,
  getFieldLabels,
} from '../prompts/ocr'
import { getClassificationPrompt, validateClassificationResult } from '../prompts/classify'
import { getValidFixture } from './fixtures'

// Document types that support OCR extraction
const OCR_SUPPORTED_TYPES = [
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
]

// =============================================================================
// BENCHMARK CONFIGURATION
// =============================================================================
const BENCHMARK_ITERATIONS = 100
const MAX_PROMPT_GENERATION_MS = 5 // Max time for single prompt generation
const MAX_VALIDATION_MS = 1 // Max time for single validation
const MAX_CLASSIFICATION_PROMPT_LENGTH = 10000 // Characters
const MIN_OCR_PROMPT_LENGTH = 500 // Minimum characters for useful prompt

// =============================================================================
// PROMPT GENERATION PERFORMANCE TESTS
// =============================================================================
describe('Prompt Generation Performance', () => {
  describe('Classification Prompt', () => {
    it('generates classification prompt within time limit', () => {
      const startTime = performance.now()

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        getClassificationPrompt()
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / BENCHMARK_ITERATIONS

      expect(avgTime).toBeLessThan(MAX_PROMPT_GENERATION_MS)
      console.log(`Classification prompt generation: ${avgTime.toFixed(3)}ms avg over ${BENCHMARK_ITERATIONS} iterations`)
    })

    it('classification prompt has reasonable length', () => {
      const prompt = getClassificationPrompt()
      expect(prompt.length).toBeGreaterThan(1000) // Should have enough detail
      expect(prompt.length).toBeLessThan(MAX_CLASSIFICATION_PROMPT_LENGTH)
      console.log(`Classification prompt length: ${prompt.length} characters`)
    })
  })

  describe('OCR Prompts', () => {
    for (const docType of OCR_SUPPORTED_TYPES) {
      it(`generates ${docType} OCR prompt within time limit`, () => {
        const startTime = performance.now()

        for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
          getOcrPromptForDocType(docType)
        }

        const endTime = performance.now()
        const avgTime = (endTime - startTime) / BENCHMARK_ITERATIONS

        expect(avgTime).toBeLessThan(MAX_PROMPT_GENERATION_MS)
      })
    }

    it('all OCR prompts have sufficient detail', () => {
      const promptLengths: Record<string, number> = {}

      for (const docType of OCR_SUPPORTED_TYPES) {
        const prompt = getOcrPromptForDocType(docType)
        expect(prompt).not.toBeNull()
        promptLengths[docType] = prompt!.length
        expect(prompt!.length).toBeGreaterThan(MIN_OCR_PROMPT_LENGTH)
      }

      console.log('\nOCR Prompt Lengths:')
      Object.entries(promptLengths)
        .sort((a, b) => b[1] - a[1])
        .forEach(([docType, length]) => {
          console.log(`  ${docType}: ${length} chars`)
        })
    })
  })
})

// =============================================================================
// VALIDATION PERFORMANCE TESTS
// =============================================================================
describe('Validation Performance', () => {
  describe('Classification Result Validation', () => {
    it('validates classification result within time limit', () => {
      const validResult = {
        docType: 'W2',
        confidence: 0.92,
        reasoning: 'Clear W-2 form visible',
      }

      const startTime = performance.now()

      for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
        validateClassificationResult(validResult)
      }

      const endTime = performance.now()
      const avgTime = (endTime - startTime) / BENCHMARK_ITERATIONS

      expect(avgTime).toBeLessThan(MAX_VALIDATION_MS)
      console.log(`Classification validation: ${avgTime.toFixed(4)}ms avg over ${BENCHMARK_ITERATIONS} iterations`)
    })
  })

  describe('OCR Data Validation', () => {
    // Test validation for each document type that has fixtures
    const fixtureTypes = [
      'W2',
      'FORM_1099_K',
      'SCHEDULE_K1',
      'BANK_STATEMENT',
      'FORM_1099_DIV',
      'FORM_1099_R',
      'FORM_1099_SSA',
      'FORM_1098',
      'FORM_1095_A',
      'FORM_1098_T',
      'FORM_1099_G',
      'FORM_1099_MISC',
      'SSN_CARD',
      'DRIVER_LICENSE',
    ]

    for (const docType of fixtureTypes) {
      it(`validates ${docType} data within time limit`, () => {
        const fixture = getValidFixture(docType)
        if (!fixture) {
          console.log(`Skipping ${docType} - no fixture available`)
          return
        }

        const startTime = performance.now()

        for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
          validateExtractedData(docType, fixture)
        }

        const endTime = performance.now()
        const avgTime = (endTime - startTime) / BENCHMARK_ITERATIONS

        expect(avgTime).toBeLessThan(MAX_VALIDATION_MS)
      })
    }
  })
})

// =============================================================================
// MEMORY AND SIZE TESTS
// =============================================================================
describe('Resource Usage', () => {
  it('total OCR prompt size is reasonable', () => {
    let totalSize = 0

    for (const docType of OCR_SUPPORTED_TYPES) {
      const prompt = getOcrPromptForDocType(docType)
      if (prompt) {
        totalSize += prompt.length
      }
    }

    // Total prompts should be under 100KB when loaded
    expect(totalSize).toBeLessThan(100000)
    console.log(`Total OCR prompt size: ${(totalSize / 1024).toFixed(2)} KB`)
  })

  it('supportsOcrExtraction is fast for all types', () => {
    const allTypes = [
      ...OCR_SUPPORTED_TYPES,
      'UNKNOWN',
      'PASSPORT',
      'RECEIPT',
      'OTHER',
      'BUSINESS_LICENSE',
    ]

    const startTime = performance.now()

    for (let i = 0; i < BENCHMARK_ITERATIONS; i++) {
      for (const docType of allTypes) {
        supportsOcrExtraction(docType)
      }
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime
    const avgTime = totalTime / (BENCHMARK_ITERATIONS * allTypes.length)

    expect(avgTime).toBeLessThan(0.1) // Should be microseconds
    console.log(`supportsOcrExtraction avg: ${(avgTime * 1000).toFixed(3)}μs`)
  })

  it('getFieldLabels returns reasonable label counts', () => {
    const labelCounts: Record<string, number> = {}

    for (const docType of OCR_SUPPORTED_TYPES) {
      const labels = getFieldLabels(docType)
      labelCounts[docType] = Object.keys(labels).length
      expect(Object.keys(labels).length).toBeGreaterThan(3) // Minimum fields
      expect(Object.keys(labels).length).toBeLessThan(100) // Reasonable max
    }

    console.log('\nField Label Counts:')
    Object.entries(labelCounts)
      .sort((a, b) => b[1] - a[1])
      .forEach(([docType, count]) => {
        console.log(`  ${docType}: ${count} labels`)
      })
  })
})

// =============================================================================
// BATCH OPERATION TESTS
// =============================================================================
describe('Batch Operations', () => {
  it('handles batch prompt generation efficiently', () => {
    const startTime = performance.now()

    // Simulate batch processing of 50 documents
    const batchSize = 50
    const results: string[] = []

    for (let i = 0; i < batchSize; i++) {
      const docType = OCR_SUPPORTED_TYPES[i % OCR_SUPPORTED_TYPES.length]
      const prompt = getOcrPromptForDocType(docType)
      if (prompt) results.push(prompt)
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime

    expect(results.length).toBe(batchSize)
    expect(totalTime).toBeLessThan(50) // Should complete in under 50ms
    console.log(`Batch of ${batchSize} prompts: ${totalTime.toFixed(2)}ms`)
  })

  it('handles batch validation efficiently', () => {
    const fixtures = OCR_SUPPORTED_TYPES
      .map(type => ({ type, data: getValidFixture(type) }))
      .filter(f => f.data !== null)

    const startTime = performance.now()
    const batchSize = fixtures.length * 10 // 10 iterations per type
    let validCount = 0

    for (let i = 0; i < 10; i++) {
      for (const { type, data } of fixtures) {
        if (validateExtractedData(type, data!)) {
          validCount++
        }
      }
    }

    const endTime = performance.now()
    const totalTime = endTime - startTime

    expect(validCount).toBe(batchSize)
    expect(totalTime).toBeLessThan(100) // Should complete in under 100ms
    console.log(`Batch of ${batchSize} validations: ${totalTime.toFixed(2)}ms`)
  })
})

// =============================================================================
// SUMMARY REPORT
// =============================================================================
describe('Benchmark Summary', () => {
  beforeAll(() => {
    console.log('\n========================================')
    console.log('AI PROMPTS PERFORMANCE BENCHMARK SUMMARY')
    console.log('========================================\n')
  })

  it('generates summary report', () => {
    const stats = {
      totalOcrTypes: OCR_SUPPORTED_TYPES.length,
      classificationPromptLength: getClassificationPrompt().length,
      avgOcrPromptLength: 0,
      totalPromptSize: 0,
    }

    let totalLength = 0
    for (const docType of OCR_SUPPORTED_TYPES) {
      const prompt = getOcrPromptForDocType(docType)
      if (prompt) {
        totalLength += prompt.length
        stats.totalPromptSize += prompt.length
      }
    }
    stats.avgOcrPromptLength = Math.round(totalLength / OCR_SUPPORTED_TYPES.length)

    console.log('Performance Statistics:')
    console.log(`  - Total OCR types supported: ${stats.totalOcrTypes}`)
    console.log(`  - Classification prompt: ${stats.classificationPromptLength} chars`)
    console.log(`  - Avg OCR prompt: ${stats.avgOcrPromptLength} chars`)
    console.log(`  - Total prompt memory: ${(stats.totalPromptSize / 1024).toFixed(2)} KB`)
    console.log('')

    // Assertions to ensure stats are reasonable
    expect(stats.totalOcrTypes).toBeGreaterThanOrEqual(16)
    expect(stats.avgOcrPromptLength).toBeGreaterThan(500)
    expect(stats.totalPromptSize).toBeLessThan(150000)
  })
})
