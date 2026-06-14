import { describe, expect, it } from 'vitest'
import {
  hasVietnameseCommonWords,
  hasVietnameseDiacritics,
  isLikelyVietnamese,
} from './message-language-detection'

describe('message language detection', () => {
  it('detects Vietnamese diacritics', () => {
    expect(hasVietnameseDiacritics('chị gửi hồ sơ thuế')).toBe(true)
    expect(isLikelyVietnamese('Chị gửi hồ sơ thuế 2025 giúp em')).toBe(true)
  })

  it('detects common no-diacritic Vietnamese chat words', () => {
    expect(hasVietnameseCommonWords('chi gui giay thue giup em')).toBe(true)
    expect(isLikelyVietnamese('em gui ho so nam nay')).toBe(true)
  })

  it('does not flag English-only text', () => {
    expect(isLikelyVietnamese('Please send the business tax return.')).toBe(false)
  })

  it('does not flag URLs, numbers, or very short ambiguous one-token text', () => {
    expect(isLikelyVietnamese('https://example.com')).toBe(false)
    expect(isLikelyVietnamese('123456')).toBe(false)
    expect(isLikelyVietnamese('chi')).toBe(false)
  })
})
