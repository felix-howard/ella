/**
 * Continuation Page Detection Tests (Phase 5)
 * Unit tests for detectParentForm, generateContinuationDisplayName,
 * isContinuationPage, and getContinuationCategory functions
 */

import { describe, it, expect } from 'vitest'
import type { ContinuationMarker } from '../prompts/classify'
import {
  detectParentForm,
  generateContinuationDisplayName,
  isContinuationPage,
  getContinuationCategory,
} from '../continuation-detection'

describe('detectParentForm', () => {
  describe('null/undefined input handling', () => {
    it('returns null for null input', () => {
      const result = detectParentForm(null)
      expect(result).toBeNull()
    })

    it('returns null for undefined input', () => {
      const result = detectParentForm(undefined)
      expect(result).toBeNull()
    })
  })

  describe('explicit parentForm detection', () => {
    it('returns parentForm when explicitly set in marker', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: 'FORM_2210',
        lineNumber: '19',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('FORM_2210')
    })

    it('returns parentForm even with null type', () => {
      const marker: ContinuationMarker = {
        type: null,
        parentForm: 'SCHEDULE_E',
        lineNumber: null,
      }
      const result = detectParentForm(marker)
      expect(result).toBe('SCHEDULE_E')
    })

    it('prefers explicit parentForm over line number matching', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: 'FORM_4562',
        lineNumber: '19', // Would match FORM_2210 without explicit parentForm
      }
      const result = detectParentForm(marker)
      expect(result).toBe('FORM_4562')
    })
  })

  describe('line-reference pattern matching', () => {
    it('returns FORM_2210 for lineNumber "19"', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '19',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('FORM_2210')
    })

    it('returns SCHEDULE_1 for lineNumber "8"', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '8',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('SCHEDULE_1')
    })

    it('returns SCHEDULE_1 for lineNumber "8a"', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '8a',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('SCHEDULE_1')
    })

    it('returns SCHEDULE_E for lineNumber "21"', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '21',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('SCHEDULE_E')
    })

    it('returns SCHEDULE_C for lineNumber "31"', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '31',
      }
      const result = detectParentForm(marker)
      expect(result).toBe('SCHEDULE_C')
    })

    it('returns null for unrecognized line number', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: null,
        lineNumber: '99',
      }
      const result = detectParentForm(marker)
      expect(result).toBeNull()
    })

    it('does not match line number if type is not line-reference', () => {
      const marker: ContinuationMarker = {
        type: 'attachment',
        parentForm: null,
        lineNumber: '19',
      }
      const result = detectParentForm(marker)
      expect(result).toBeNull()
    })
  })

  describe('attachment type handling', () => {
    it('returns null for attachment type without parent', () => {
      const marker: ContinuationMarker = {
        type: 'attachment',
        parentForm: null,
        lineNumber: null,
      }
      const result = detectParentForm(marker)
      expect(result).toBeNull()
    })

    it('returns null for see-attached type without parent', () => {
      const marker: ContinuationMarker = {
        type: 'see-attached',
        parentForm: null,
        lineNumber: null,
      }
      const result = detectParentForm(marker)
      expect(result).toBeNull()
    })

    it('returns parentForm for attachment type with explicit parent', () => {
      const marker: ContinuationMarker = {
        type: 'attachment',
        parentForm: 'FORM_8949',
        lineNumber: null,
      }
      const result = detectParentForm(marker)
      expect(result).toBe('FORM_8949')
    })
  })
})

describe('generateContinuationDisplayName', () => {
  describe('basic name generation', () => {
    it('creates name with year, line number, parent form, taxpayer', () => {
      const result = generateContinuationDisplayName(
        'FORM_2210',
        '19',
        'Nguyen Van Anh',
        2024
      )
      expect(result).toBe('2024_Line19_FORM_2210_NguyenVanAnh')
    })

    it('creates name with all components', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_E',
        null,
        'Tran Thi Hong',
        2023
      )
      expect(result).toBe('2023_SCHEDULE_E_Continuation_TranThiHong')
    })
  })

  describe('without year', () => {
    it('omits year when null', () => {
      const result = generateContinuationDisplayName(
        'FORM_4562',
        '5',
        'John Doe',
        null
      )
      expect(result).toBe('Line5_FORM_4562_JohnDoe')
    })
  })

  describe('without line number', () => {
    it('uses "Continuation" when line number is null', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_D',
        null,
        'Mary Smith',
        2024
      )
      expect(result).toBe('2024_SCHEDULE_D_Continuation_MarySmith')
    })
  })

  describe('without taxpayer name', () => {
    it('omits taxpayer when null', () => {
      const result = generateContinuationDisplayName(
        'FORM_2210',
        '19',
        null,
        2024
      )
      expect(result).toBe('2024_Line19_FORM_2210')
    })

    it('omits taxpayer when empty string', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_1',
        '8',
        '',
        2024
      )
      expect(result).toBe('2024_Line8_SCHEDULE_1')
    })

    it('omits taxpayer when only whitespace', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_C',
        '31',
        '   ',
        2024
      )
      expect(result).toBe('2024_Line31_SCHEDULE_C')
    })
  })

  describe('taxpayer name normalization', () => {
    it('removes spaces from taxpayer name', () => {
      const result = generateContinuationDisplayName(
        'FORM_8949',
        null,
        'Nguyen Van Anh',
        2024
      )
      expect(result).toBe('2024_FORM_8949_Continuation_NguyenVanAnh')
    })

    it('removes special characters from taxpayer name', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_E',
        '21',
        "O'Brien-Smith",
        2024
      )
      expect(result).toBe('2024_Line21_SCHEDULE_E_OBrienSmith')
    })

    it('removes accents and diacritics', () => {
      const result = generateContinuationDisplayName(
        'FORM_2210',
        '19',
        'José García',
        2024
      )
      // Note: Only removes non-alphanumeric and spaces
      expect(result).toContain('Garca')
    })

    it('handles mixed case and special characters', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_A',
        null,
        'Jean-Pierre Dumont!!!',
        2024
      )
      expect(result).toBe('2024_SCHEDULE_A_Continuation_JeanPierreDumont')
    })
  })

  describe('name truncation', () => {
    it('truncates long taxpayer names to 20 chars', () => {
      const result = generateContinuationDisplayName(
        'FORM_4562',
        '5',
        'VeryLongNameThatExceedsMaxLength',
        2024
      )
      const parts = result.split('_')
      expect(parts[parts.length - 1]).toHaveLength(20)
      expect(parts[parts.length - 1]).toBe('VeryLongNameThatExce')
    })

    it('truncates to exactly 20 chars', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_D',
        null,
        'ExactlyTwentyCharsTw',
        2024
      )
      const parts = result.split('_')
      expect(parts[parts.length - 1]).toHaveLength(20)
    })

    it('handles Vietnamese names with truncation', () => {
      const result = generateContinuationDisplayName(
        'FORM_2210',
        '19',
        'Nguyen Van Anh The Long Extended',
        2024
      )
      const parts = result.split('_')
      // Should be truncated to 20 chars
      expect(parts[parts.length - 1]).toHaveLength(20)
    })
  })

  describe('edge cases', () => {
    it('handles all null optional fields', () => {
      const result = generateContinuationDisplayName(
        'FORM_8949',
        null,
        null,
        null
      )
      expect(result).toBe('FORM_8949_Continuation')
    })

    it('omits year 0 (falsy value)', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_1',
        '8',
        'Test',
        0
      )
      // Year 0 is falsy, so it gets skipped
      expect(result).toBe('Line8_SCHEDULE_1_Test')
    })

    it('handles very long year', () => {
      const result = generateContinuationDisplayName(
        'SCHEDULE_C',
        '31',
        'Name',
        2025
      )
      expect(result).toMatch(/^2025_/)
    })
  })
})

describe('isContinuationPage', () => {
  describe('null/undefined input', () => {
    it('returns false for null input', () => {
      const result = isContinuationPage(null)
      expect(result).toBe(false)
    })

    it('returns false for undefined input', () => {
      const result = isContinuationPage(undefined)
      expect(result).toBe(false)
    })
  })

  describe('continuation marker type checking', () => {
    it('returns true for line-reference type', () => {
      const marker: ContinuationMarker = {
        type: 'line-reference',
        parentForm: 'FORM_2210',
        lineNumber: '19',
      }
      const result = isContinuationPage(marker)
      expect(result).toBe(true)
    })

    it('returns true for attachment type', () => {
      const marker: ContinuationMarker = {
        type: 'attachment',
        parentForm: null,
        lineNumber: null,
      }
      const result = isContinuationPage(marker)
      expect(result).toBe(true)
    })

    it('returns true for see-attached type', () => {
      const marker: ContinuationMarker = {
        type: 'see-attached',
        parentForm: null,
        lineNumber: null,
      }
      const result = isContinuationPage(marker)
      expect(result).toBe(true)
    })

    it('returns false for null type', () => {
      const marker: ContinuationMarker = {
        type: null,
        parentForm: null,
        lineNumber: null,
      }
      const result = isContinuationPage(marker)
      expect(result).toBe(false)
    })
  })
})

describe('getContinuationCategory', () => {
  describe('null parent form', () => {
    it('returns OTHER for null parent', () => {
      const result = getContinuationCategory(null)
      expect(result).toBe('OTHER')
    })
  })

  describe('FORM_ prefix', () => {
    it('returns TAX_FORM for FORM_2210', () => {
      const result = getContinuationCategory('FORM_2210')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for FORM_4562', () => {
      const result = getContinuationCategory('FORM_4562')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for FORM_8949', () => {
      const result = getContinuationCategory('FORM_8949')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for any FORM_ prefix', () => {
      const result = getContinuationCategory('FORM_1040')
      expect(result).toBe('TAX_FORM')
    })
  })

  describe('SCHEDULE_ prefix', () => {
    it('returns TAX_FORM for SCHEDULE_A', () => {
      const result = getContinuationCategory('SCHEDULE_A')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for SCHEDULE_C', () => {
      const result = getContinuationCategory('SCHEDULE_C')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for SCHEDULE_E', () => {
      const result = getContinuationCategory('SCHEDULE_E')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for SCHEDULE_1', () => {
      const result = getContinuationCategory('SCHEDULE_1')
      expect(result).toBe('TAX_FORM')
    })

    it('returns TAX_FORM for any SCHEDULE_ prefix', () => {
      const result = getContinuationCategory('SCHEDULE_SE')
      expect(result).toBe('TAX_FORM')
    })
  })

  describe('non-form parent types', () => {
    it('returns OTHER for unknown form type', () => {
      const result = getContinuationCategory('UNKNOWN')
      expect(result).toBe('OTHER')
    })

    it('returns OTHER for empty string', () => {
      const result = getContinuationCategory('')
      expect(result).toBe('OTHER')
    })

    it('returns OTHER for random string', () => {
      const result = getContinuationCategory('CONTINUATION_SHEET')
      expect(result).toBe('OTHER')
    })

    it('returns OTHER for lowercase form', () => {
      const result = getContinuationCategory('form_1040')
      expect(result).toBe('OTHER')
    })
  })

  describe('integration scenarios', () => {
    it('categorizes common tax form continuations', () => {
      const testCases = [
        { parent: 'FORM_2210', expected: 'TAX_FORM' },
        { parent: 'SCHEDULE_C', expected: 'TAX_FORM' },
        { parent: 'FORM_4562', expected: 'TAX_FORM' },
        { parent: 'SCHEDULE_E', expected: 'TAX_FORM' },
        { parent: null, expected: 'OTHER' },
      ]

      testCases.forEach(({ parent, expected }) => {
        expect(getContinuationCategory(parent)).toBe(expected)
      })
    })
  })
})

describe('Integration: detectParentForm + getContinuationCategory', () => {
  it('correctly categorizes detected parent forms', () => {
    const marker: ContinuationMarker = {
      type: 'line-reference',
      parentForm: null,
      lineNumber: '19',
    }
    const parentForm = detectParentForm(marker)
    const category = getContinuationCategory(parentForm)

    expect(parentForm).toBe('FORM_2210')
    expect(category).toBe('TAX_FORM')
  })

  it('handles generic attachment with no parent form', () => {
    const marker: ContinuationMarker = {
      type: 'see-attached',
      parentForm: null,
      lineNumber: null,
    }
    const parentForm = detectParentForm(marker)
    const category = getContinuationCategory(parentForm)

    expect(parentForm).toBeNull()
    expect(category).toBe('OTHER')
  })
})

describe('Integration: detectParentForm + generateContinuationDisplayName', () => {
  it('generates display name for detected continuation', () => {
    const marker: ContinuationMarker = {
      type: 'line-reference',
      parentForm: null,
      lineNumber: '21',
    }
    const parentForm = detectParentForm(marker)
    const displayName = generateContinuationDisplayName(
      parentForm || 'UNKNOWN',
      marker.lineNumber,
      'Tran Thi Hong',
      2024
    )

    expect(parentForm).toBe('SCHEDULE_E')
    expect(displayName).toBe('2024_Line21_SCHEDULE_E_TranThiHong')
  })
})

describe('Integration: isContinuationPage + getContinuationCategory', () => {
  it('correctly categorizes valid continuation pages', () => {
    const testMarkers: ContinuationMarker[] = [
      {
        type: 'line-reference',
        parentForm: 'FORM_2210',
        lineNumber: '19',
      },
      {
        type: 'attachment',
        parentForm: 'SCHEDULE_C',
        lineNumber: null,
      },
      {
        type: null,
        parentForm: null,
        lineNumber: null,
      },
    ]

    const results = testMarkers.map((marker) => ({
      isContinuation: isContinuationPage(marker),
      category: marker.parentForm ? getContinuationCategory(marker.parentForm) : 'OTHER',
    }))

    expect(results[0]).toEqual({
      isContinuation: true,
      category: 'TAX_FORM',
    })
    expect(results[1]).toEqual({
      isContinuation: true,
      category: 'TAX_FORM',
    })
    expect(results[2]).toEqual({
      isContinuation: false,
      category: 'OTHER',
    })
  })
})
