import { describe, expect, it, vi } from 'vitest'

const translations: Record<string, string> = {
  'docCategory.bankCardStatements': 'Bank/Card Statements',
  'docType.creditCardStatement': 'Credit Card Statement',
  'docType.foreignBankStatement': 'Foreign Bank Statement',
  'docCategory.business': 'Business',
  'fieldGroup.statementSummary': 'Statement Summary',
}

vi.mock('./i18n', () => ({
  default: {
    t: (key: string) => translations[key] ?? key,
  },
}))

import { DOC_TYPE_CATEGORIES, DOC_TYPE_LABELS } from './constants'
import { CATEGORY_ORDER, DOC_CATEGORIES, isValidCategory } from './doc-categories'
import { DOC_TYPE_FIELD_GROUPS } from './doc-type-field-groups'
import { getDocTypeFields } from './doc-type-fields'
import { CATEGORY_STYLES } from './checklist-tier-constants'
import { SUPPORTED_DOC_TYPES } from '../components/documents/manual-classification-modal'
import { COMMON_DOC_TYPES } from '../components/verification/doc-verification-modal'

describe('document taxonomy UI config', () => {
  it('exposes bank/card statements as a real files category', () => {
    expect(isValidCategory('BANK_CARD_STATEMENTS')).toBe(true)
    expect(CATEGORY_ORDER).toContain('BANK_CARD_STATEMENTS')
    expect(CATEGORY_ORDER.indexOf('BANK_CARD_STATEMENTS')).toBe(
      CATEGORY_ORDER.indexOf('INCOME') + 1
    )
    expect(DOC_CATEGORIES.BANK_CARD_STATEMENTS.label).toBe('Bank/Card Statements')
  })

  it('labels and groups credit card statements for manual controls and verification', () => {
    expect(DOC_TYPE_LABELS.CREDIT_CARD_STATEMENT).toBe('Credit Card Statement')
    expect(DOC_TYPE_CATEGORIES.bankCardStatements.docTypes).toEqual([
      'BANK_STATEMENT',
      'CREDIT_CARD_STATEMENT',
      'FOREIGN_BANK_STATEMENT',
    ])
    expect(DOC_TYPE_CATEGORIES.business.docTypes).not.toContain('CREDIT_CARD_STATEMENT')
    expect(DOC_TYPE_LABELS.FOREIGN_BANK_STATEMENT).toBe('Foreign Bank Statement')
    expect(CATEGORY_STYLES.bankCardStatements.icon).toBe('CreditCard')
    expect(SUPPORTED_DOC_TYPES).toContain('CREDIT_CARD_STATEMENT')
    expect(SUPPORTED_DOC_TYPES).toContain('FOREIGN_BANK_STATEMENT')
    expect(COMMON_DOC_TYPES).toContain('CREDIT_CARD_STATEMENT')
    expect(COMMON_DOC_TYPES).toContain('FOREIGN_BANK_STATEMENT')

    expect(getDocTypeFields('CREDIT_CARD_STATEMENT')).toEqual([
      'issuerName',
      'accountHolderName',
      'accountNumber',
      'statementPeriodStart',
      'statementPeriodEnd',
      'previousBalance',
      'payments',
      'purchases',
      'credits',
      'fees',
      'interestCharged',
      'endingBalance',
      'minimumPaymentDue',
      'paymentDueDate',
      'creditLimit',
    ])

    expect(DOC_TYPE_FIELD_GROUPS.CREDIT_CARD_STATEMENT[0]).toMatchObject({
      key: 'statement',
      label: 'Statement Summary',
      fields: expect.arrayContaining([
        'issuerName',
        'accountNumber',
        'purchases',
        'endingBalance',
        'minimumPaymentDue',
      ]),
    })
  })
})
