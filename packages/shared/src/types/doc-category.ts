/**
 * Document Category Mapping Utility
 * Maps DocType to DocCategory for file naming and grouping
 *
 * NOTE: DocType and DocCategory types are defined here to avoid
 * circular dependency with @ella/db package. These must be kept
 * in sync with prisma schema.
 */

/**
 * Document category enum (mirrors DocCategory from @ella/db)
 */
export type DocCategory =
  | 'IDENTITY'
  | 'INCOME'
  | 'EXPENSE'
  | 'ASSET'
  | 'EDUCATION'
  | 'HEALTHCARE'
  | 'OTHER'

/**
 * Document type enum (mirrors DocType from @ella/db)
 */
export type DocType =
  | 'SSN_CARD'
  | 'DRIVER_LICENSE'
  | 'PASSPORT'
  | 'BIRTH_CERTIFICATE'
  | 'ITIN_LETTER'
  | 'W2'
  | 'W2G'
  | 'FORM_1099_INT'
  | 'FORM_1099_DIV'
  | 'FORM_1099_NEC'
  | 'FORM_1099_MISC'
  | 'FORM_1099_K'
  | 'FORM_1099_R'
  | 'FORM_1099_G'
  | 'FORM_1099_SSA'
  | 'FORM_1099_B'
  | 'FORM_1099_S'
  | 'FORM_1099_C'
  | 'FORM_1099_SA'
  | 'FORM_1099_Q'
  | 'SCHEDULE_K1'
  | 'SCHEDULE_K1_1065'
  | 'SCHEDULE_K1_1120S'
  | 'SCHEDULE_K1_1041'
  | 'FORM_1095_A'
  | 'FORM_1095_B'
  | 'FORM_1095_C'
  | 'FORM_5498_SA'
  | 'FORM_1098_T'
  | 'FORM_1098_E'
  | 'FORM_1098'
  | 'FORM_8332'
  | 'BANK_STATEMENT'
  | 'PROFIT_LOSS_STATEMENT'
  | 'BALANCE_SHEET'
  | 'BUSINESS_LICENSE'
  | 'EIN_LETTER'
  | 'ARTICLES_OF_INCORPORATION'
  | 'OPERATING_AGREEMENT'
  | 'PAYROLL_REPORT'
  | 'DEPRECIATION_SCHEDULE'
  | 'VEHICLE_MILEAGE_LOG'
  | 'RECEIPT'
  | 'DAYCARE_RECEIPT'
  | 'CHARITY_RECEIPT'
  | 'MEDICAL_RECEIPT'
  | 'PROPERTY_TAX_STATEMENT'
  | 'ESTIMATED_TAX_PAYMENT'
  | 'PRIOR_YEAR_RETURN'
  | 'IRS_NOTICE'
  | 'CRYPTO_STATEMENT'
  | 'FOREIGN_BANK_STATEMENT'
  | 'FOREIGN_TAX_STATEMENT'
  | 'FBAR_SUPPORT_DOCS'
  | 'FORM_8938'
  | 'CLOSING_DISCLOSURE'
  | 'LEASE_AGREEMENT'
  | 'EV_PURCHASE_AGREEMENT'
  | 'ENERGY_CREDIT_INVOICE'
  | 'FORM_W9_ISSUED'
  | 'MORTGAGE_POINTS_STATEMENT'
  | 'EXTENSION_PAYMENT_PROOF'
  | 'OTHER'
  | 'UNKNOWN'

/**
 * Deterministic mapping from DocType to DocCategory
 * Used for auto-categorization based on classified document type
 */
export const DOC_TYPE_TO_CATEGORY: Record<DocType, DocCategory> = {
  // IDENTITY - Personal identification documents
  SSN_CARD: 'IDENTITY',
  DRIVER_LICENSE: 'IDENTITY',
  PASSPORT: 'IDENTITY',
  BIRTH_CERTIFICATE: 'IDENTITY',
  ITIN_LETTER: 'IDENTITY',

  // INCOME - Employment and various income forms
  W2: 'INCOME',
  W2G: 'INCOME',
  FORM_1099_INT: 'INCOME',
  FORM_1099_DIV: 'INCOME',
  FORM_1099_NEC: 'INCOME',
  FORM_1099_MISC: 'INCOME',
  FORM_1099_K: 'INCOME',
  FORM_1099_R: 'INCOME',
  FORM_1099_G: 'INCOME',
  FORM_1099_SSA: 'INCOME',
  FORM_1099_B: 'INCOME',
  FORM_1099_S: 'INCOME',
  FORM_1099_C: 'INCOME',
  SCHEDULE_K1: 'INCOME',
  SCHEDULE_K1_1065: 'INCOME',
  SCHEDULE_K1_1120S: 'INCOME',
  SCHEDULE_K1_1041: 'INCOME',

  // EXPENSE - Receipts and deductible expenses
  RECEIPT: 'EXPENSE',
  DAYCARE_RECEIPT: 'EXPENSE',
  CHARITY_RECEIPT: 'EXPENSE',
  MEDICAL_RECEIPT: 'EXPENSE',
  ESTIMATED_TAX_PAYMENT: 'EXPENSE',
  PROPERTY_TAX_STATEMENT: 'EXPENSE',
  FORM_1098: 'EXPENSE', // Mortgage interest deduction

  // ASSET - Property and investment documents
  FORM_1099_SA: 'ASSET',
  FORM_1099_Q: 'ASSET',
  CLOSING_DISCLOSURE: 'ASSET',
  LEASE_AGREEMENT: 'ASSET',
  EV_PURCHASE_AGREEMENT: 'ASSET',
  DEPRECIATION_SCHEDULE: 'ASSET',
  VEHICLE_MILEAGE_LOG: 'ASSET',
  FORM_5498_SA: 'ASSET', // HSA contributions

  // EDUCATION - Education-related tax forms
  FORM_1098_T: 'EDUCATION',
  FORM_1098_E: 'EDUCATION',

  // HEALTHCARE - Health insurance forms
  FORM_1095_A: 'HEALTHCARE',
  FORM_1095_B: 'HEALTHCARE',
  FORM_1095_C: 'HEALTHCARE',

  // OTHER - Business documents and miscellaneous
  BANK_STATEMENT: 'OTHER',
  PROFIT_LOSS_STATEMENT: 'OTHER',
  BALANCE_SHEET: 'OTHER',
  BUSINESS_LICENSE: 'OTHER',
  EIN_LETTER: 'OTHER',
  ARTICLES_OF_INCORPORATION: 'OTHER',
  OPERATING_AGREEMENT: 'OTHER',
  PAYROLL_REPORT: 'OTHER',
  PRIOR_YEAR_RETURN: 'OTHER',
  IRS_NOTICE: 'OTHER',
  CRYPTO_STATEMENT: 'OTHER',
  FOREIGN_BANK_STATEMENT: 'OTHER',
  FOREIGN_TAX_STATEMENT: 'OTHER',
  FBAR_SUPPORT_DOCS: 'OTHER',
  FORM_8938: 'OTHER',
  ENERGY_CREDIT_INVOICE: 'OTHER',
  FORM_W9_ISSUED: 'OTHER',
  MORTGAGE_POINTS_STATEMENT: 'OTHER',
  EXTENSION_PAYMENT_PROOF: 'OTHER',
  FORM_8332: 'OTHER',
  OTHER: 'OTHER',
  UNKNOWN: 'OTHER',
}

/**
 * Get category from document type
 * Returns 'OTHER' for null/unknown types
 */
export function getCategoryFromDocType(docType: DocType | string | null | undefined): DocCategory {
  if (!docType) return 'OTHER'
  return DOC_TYPE_TO_CATEGORY[docType as DocType] ?? 'OTHER'
}

/**
 * Category display labels (Vietnamese)
 */
export const CATEGORY_LABELS: Record<DocCategory, string> = {
  IDENTITY: 'Giấy tờ tùy thân',
  INCOME: 'Thu nhập',
  EXPENSE: 'Chi phí',
  ASSET: 'Tài sản',
  EDUCATION: 'Giáo dục',
  HEALTHCARE: 'Y tế',
  OTHER: 'Khác',
}

/**
 * Category order for UI display
 */
export const CATEGORY_ORDER: DocCategory[] = [
  'IDENTITY',
  'INCOME',
  'EXPENSE',
  'ASSET',
  'EDUCATION',
  'HEALTHCARE',
  'OTHER',
]
