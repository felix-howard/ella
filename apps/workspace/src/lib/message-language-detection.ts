const VIETNAMESE_DIACRITIC_PATTERN =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i

const LETTER_PATTERN = /\p{L}/gu
const URL_PATTERN = /^https?:\/\/\S+$/i
const COMMON_WORD_PATTERNS = [
  /\banh\b/i,
  /\bchi\b/i,
  /\bchị\b/i,
  /\bem\b/i,
  /\bco\b/i,
  /\bcô\b/i,
  /\bchu\b/i,
  /\bchú\b/i,
  /\bthue\b/i,
  /\bthuế\b/i,
  /\bgiay\b/i,
  /\bgiấy\b/i,
  /\bho so\b/i,
  /\bhồ sơ\b/i,
  /\bnam\b/i,
  /\bnăm\b/i,
  /\bgui\b/i,
  /\bgửi\b/i,
  /\bcan\b/i,
  /\bcần\b/i,
  /\bben\b/i,
  /\bbên\b/i,
  /\bvan phong\b/i,
  /\bvăn phòng\b/i,
]

function normalizeText(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

function getLetterCount(text: string): number {
  return text.match(LETTER_PATTERN)?.length ?? 0
}

export function hasVietnameseDiacritics(text: string): boolean {
  return VIETNAMESE_DIACRITIC_PATTERN.test(text.normalize('NFC'))
}

export function hasVietnameseCommonWords(text: string): boolean {
  const normalized = normalizeText(text)
  const score = COMMON_WORD_PATTERNS.reduce(
    (count, pattern) => count + (pattern.test(normalized) ? 1 : 0),
    0
  )

  return score >= 2 || (score >= 1 && getLetterCount(normalized) >= 12)
}

export function isLikelyVietnamese(text: string): boolean {
  const normalized = normalizeText(text)

  if (!normalized || URL_PATTERN.test(normalized) || getLetterCount(normalized) < 4) {
    return false
  }

  return hasVietnameseDiacritics(normalized) || hasVietnameseCommonWords(normalized)
}
