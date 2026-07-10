import { describe, expect, it } from 'vitest'

import { CATEGORY_LABELS, CATEGORY_ORDER, getCategoryFromDocType } from './doc-category'

describe('document category taxonomy', () => {
  it('routes bank and card statements to the bank/card statements category', () => {
    expect(getCategoryFromDocType('BANK_STATEMENT')).toBe('BANK_CARD_STATEMENTS')
    expect(getCategoryFromDocType('CREDIT_CARD_STATEMENT')).toBe('BANK_CARD_STATEMENTS')
    expect(getCategoryFromDocType('FOREIGN_BANK_STATEMENT')).toBe('BANK_CARD_STATEMENTS')
  })

  it('keeps the bank/card statements category visible after income', () => {
    expect(CATEGORY_LABELS.BANK_CARD_STATEMENTS).toBe('Bank/Card Statements')
    expect(CATEGORY_ORDER).toEqual([
      'IDENTITY',
      'INCOME',
      'BANK_CARD_STATEMENTS',
      'TAX_RETURNS',
      'EXPENSE',
      'ASSET',
      'EDUCATION',
      'HEALTHCARE',
      'OTHER',
    ])
  })
})
