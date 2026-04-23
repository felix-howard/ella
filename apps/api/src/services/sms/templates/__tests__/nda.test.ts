/**
 * Unit tests for the NDA invite SMS template.
 * Verifies EN + VI substitution, language fallback, and URL preservation.
 */
import { describe, it, expect } from 'vitest'
import {
  generateNdaMessage,
  NDA_TEMPLATE_NAME,
  type NdaTemplateParams,
} from '../nda'

function buildParams(overrides: Partial<NdaTemplateParams> = {}): NdaTemplateParams {
  return {
    firstName: 'Jane',
    ndaUrl: 'https://portal.ellatax.com/nda/abc123',
    language: 'EN',
    ...overrides,
  }
}

describe('generateNdaMessage', () => {
  describe('English (EN)', () => {
    it('includes firstName, NDA URL, validity notice', () => {
      const msg = generateNdaMessage(buildParams({ firstName: 'Alice', language: 'EN' }))
      expect(msg).toContain('Hi Alice')
      expect(msg).toContain('https://portal.ellatax.com/nda/abc123')
      expect(msg).toContain('7 days')
      expect(msg).toContain('HELP')
    })

    it('handles names with spaces / diacritics', () => {
      const msg = generateNdaMessage(buildParams({ firstName: 'Mary Ann', language: 'EN' }))
      expect(msg).toContain('Hi Mary Ann')
    })
  })

  describe('Vietnamese (VI)', () => {
    it('includes Vietnamese greeting + URL + 7-day notice', () => {
      const msg = generateNdaMessage(
        buildParams({ firstName: 'Nguyễn', language: 'VI', ndaUrl: 'https://x.test/nda/tok' }),
      )
      expect(msg).toContain('Chào Nguyễn')
      expect(msg).toContain('https://x.test/nda/tok')
      expect(msg).toContain('7 ngày')
      expect(msg).toContain('HELP')
    })

    it('preserves diacritics in name', () => {
      const msg = generateNdaMessage(buildParams({ firstName: 'Phạm Hồng', language: 'VI' }))
      expect(msg).toContain('Phạm Hồng')
    })
  })

  describe('Language fallback', () => {
    it('falls back to EN for an unknown language code', () => {
      // Force invalid language via type assertion — exercises runtime fallback branch
      const msg = generateNdaMessage({
        firstName: 'Jane',
        ndaUrl: 'https://x.test/nda/tok',
        language: 'FR' as unknown as NdaTemplateParams['language'],
      })
      expect(msg.startsWith('Hi Jane')).toBe(true)
    })
  })

  describe('Formatting / constraints', () => {
    it('preserves full URL without truncation', () => {
      const longUrl = 'https://portal.ellatax.com/nda/' + 'x'.repeat(50)
      const msg = generateNdaMessage(buildParams({ ndaUrl: longUrl }))
      expect(msg).toContain(longUrl)
    })

    it('produces distinct outputs per language', () => {
      const en = generateNdaMessage(buildParams({ language: 'EN' }))
      const vi = generateNdaMessage(buildParams({ language: 'VI' }))
      expect(en).not.toEqual(vi)
    })
  })

  it('exports stable template name constant', () => {
    expect(NDA_TEMPLATE_NAME).toBe('nda')
  })
})
