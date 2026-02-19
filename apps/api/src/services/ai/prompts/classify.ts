/**
 * Document Classification Prompt
 * Prompt for classifying tax document types using Gemini vision
 * Enhanced with few-shot examples, Vietnamese name handling, and confidence calibration
 */

// All supported document types matching the DocType enum in schema
export const SUPPORTED_DOC_TYPES = [
  // Personal / Identity
  'SSN_CARD',
  'DRIVER_LICENSE',
  'PASSPORT',
  'BIRTH_CERTIFICATE',
  'ITIN_LETTER',

  // Employment Income
  'W2',
  'W2G',

  // 1099 Series - Various Income
  'FORM_1099_INT',
  'FORM_1099_DIV',
  'FORM_1099_NEC',
  'FORM_1099_MISC',
  'FORM_1099_K',
  'FORM_1099_R',
  'FORM_1099_G',
  'FORM_1099_SSA',
  'FORM_1099_B',
  'FORM_1099_S',
  'FORM_1099_C',
  'FORM_1099_SA',
  'FORM_1099_Q',

  // K-1 Forms (Pass-through income)
  'SCHEDULE_K1',
  'SCHEDULE_K1_1065',
  'SCHEDULE_K1_1120S',
  'SCHEDULE_K1_1041',

  // Health Insurance
  'FORM_1095_A',
  'FORM_1095_B',
  'FORM_1095_C',
  'FORM_5498_SA',

  // Education
  'FORM_1098_T',
  'FORM_1098_E',

  // Deductions / Credits
  'FORM_1098',
  'FORM_8332',

  // Business Documents
  'BANK_STATEMENT',
  'PROFIT_LOSS_STATEMENT',
  'BALANCE_SHEET',
  'BUSINESS_LICENSE',
  'EIN_LETTER',
  'ARTICLES_OF_INCORPORATION',
  'OPERATING_AGREEMENT',
  'PAYROLL_REPORT',
  'DEPRECIATION_SCHEDULE',
  'VEHICLE_MILEAGE_LOG',

  // Receipts & Supporting Docs
  'RECEIPT',
  'DAYCARE_RECEIPT',
  'CHARITY_RECEIPT',
  'MEDICAL_RECEIPT',
  'PROPERTY_TAX_STATEMENT',
  'ESTIMATED_TAX_PAYMENT',

  // Prior Year / IRS
  'PRIOR_YEAR_RETURN',
  'IRS_NOTICE',

  // Crypto
  'CRYPTO_STATEMENT',

  // Foreign
  'FOREIGN_BANK_STATEMENT',
  'FOREIGN_TAX_STATEMENT',
  'FBAR_SUPPORT_DOCS',
  'FORM_8938',

  // Real Estate / Home Sale
  'CLOSING_DISCLOSURE',
  'LEASE_AGREEMENT',

  // Credits / Energy
  'EV_PURCHASE_AGREEMENT',
  'ENERGY_CREDIT_INVOICE',

  // Additional Business Docs
  'FORM_W9_ISSUED',
  'MORTGAGE_POINTS_STATEMENT',

  // Prior Year Extension
  'EXTENSION_PAYMENT_PROOF',

  // Tax Returns
  'FORM_1040',
  'FORM_1040_SR',
  'FORM_1040_NR',
  'FORM_1040_X',
  'STATE_TAX_RETURN',
  'FOREIGN_TAX_RETURN',
  'TAX_RETURN_TRANSCRIPT',

  // Form 1040 Schedules
  'SCHEDULE_C',
  'SCHEDULE_SE',
  'SCHEDULE_1',
  'SCHEDULE_D',
  'SCHEDULE_E',

  // Other
  'OTHER',
  'UNKNOWN',
] as const

export type SupportedDocType = (typeof SUPPORTED_DOC_TYPES)[number]

/**
 * Expected classification result structure
 */
export interface ClassificationResult {
  docType: SupportedDocType | 'UNKNOWN'
  confidence: number // 0-1 scale
  reasoning: string
  alternativeTypes?: Array<{
    docType: SupportedDocType
    confidence: number
  }>
  // Naming components for auto-rename feature
  taxYear: number | null // e.g., 2025 - extracted from document period
  source: string | null // Employer/bank/issuer name - extracted from document
  recipientName: string | null // Person's name from document (employee, recipient, account holder)
}

/**
 * Few-shot examples for improved classification accuracy
 * Covers common confusion cases (1099 variants, ID documents)
 */
const FEW_SHOT_EXAMPLES = `
CLASSIFICATION EXAMPLES:

EXAMPLE 1 - W-2 Form:
Image shows: Form with "W-2 Wage and Tax Statement" title, boxes for wages $45,000, federal tax $6,750
Response: {"docType":"W2","confidence":0.95,"reasoning":"Clear W-2 form with visible title 'Wage and Tax Statement', Box 1 wages, Box 2 federal tax withheld"}

EXAMPLE 2 - Social Security Card:
Image shows: Blue card with "SOCIAL SECURITY" header, 9-digit number XXX-XX-XXXX, name in capital letters
Response: {"docType":"SSN_CARD","confidence":0.92,"reasoning":"Blue Social Security card format with visible SSN number and cardholder name"}

EXAMPLE 3 - 1099-K (Payment Card):
Image shows: Form 1099-K from Square Inc/PayPal, Box 1a gross amount $85,000, monthly breakdown
Response: {"docType":"FORM_1099_K","confidence":0.94,"reasoning":"1099-K form from payment processor showing card transactions, gross amount in Box 1a"}

EXAMPLE 4 - 1099-INT (Interest):
Image shows: Form 1099-INT from Chase Bank, Box 1 interest income $523.45
Response: {"docType":"FORM_1099_INT","confidence":0.93,"reasoning":"1099-INT from bank showing interest income in Box 1, payer is financial institution"}

EXAMPLE 5 - 1099-NEC (Contractor):
Image shows: Form 1099-NEC, Box 1 nonemployee compensation $12,500, payer is company not bank/processor
Response: {"docType":"FORM_1099_NEC","confidence":0.91,"reasoning":"1099-NEC showing contractor income in Box 1, payer is business (not bank or payment processor)"}

EXAMPLE 6 - Driver's License:
Image shows: State-issued card with photo, DL number, DOB, expiration date, address
Response: {"docType":"DRIVER_LICENSE","confidence":0.94,"reasoning":"State-issued driver's license with photo ID, license number, and expiration date visible"}

EXAMPLE 7 - Form 1040 (Standard):
Image shows: Multi-page PDF with "Form 1040" title, "U.S. Individual Income Tax Return", tax year 2023, filing status checkboxes, "Department of the Treasury—Internal Revenue Service", Line 1 wages, Line 11 AGI, Line 24 total tax
Response: {"docType":"FORM_1040","confidence":0.93,"reasoning":"Form 1040 header clearly visible with 'U.S. Individual Income Tax Return' title, IRS logo, tax year 2023, filing status section, and income/tax summary lines","taxYear":2023,"recipientName":"NGUYEN VAN ANH"}

EXAMPLE 8 - Form 1040-X (Amended):
Image shows: "Form 1040-X" title, "Amended U.S. Individual Income Tax Return", columns A/B/C for original/net change/correct amounts, explanation of changes section at bottom
Response: {"docType":"FORM_1040_X","confidence":0.91,"reasoning":"Form 1040-X with 'Amended U.S. Individual Income Tax Return' header, three-column layout for comparing original vs. corrected amounts","taxYear":2022}

EXAMPLE 9 - State Tax Return (CA 540):
Image shows: "California Resident Income Tax Return" header, "Form 540", Franchise Tax Board logo, California state seal, CA AGI line, CA tax liability
Response: {"docType":"STATE_TAX_RETURN","confidence":0.90,"reasoning":"California Form 540 state income tax return with Franchise Tax Board branding and CA-specific tax lines","taxYear":2023}

EXAMPLE 10 - Schedule C (Self-Employment):
Image shows: "SCHEDULE C (Form 1040)" header, "Profit or Loss From Business" subtitle, "(Sole Proprietorship)" indicator, six-digit principal business code, Part I Income with gross receipts Line 1, Part II Expenses Lines 8-27, net profit Line 31
Response: {"docType":"SCHEDULE_C","confidence":0.92,"reasoning":"Schedule C form identified by 'Profit or Loss From Business' subtitle, sole proprietorship designation, IRS line number structure for business income and expenses","taxYear":2024,"recipientName":"NGUYEN VAN ANH"}
`

/**
 * Vietnamese name handling guidance
 * Critical for accurate processing of nail salon client documents
 */
const VIETNAMESE_NAME_HANDLING = `
VIETNAMESE NAME HANDLING:
- Vietnamese names have family name FIRST: "NGUYEN VAN ANH" → Family name is NGUYEN
- Common Vietnamese family names: Nguyen, Tran, Le, Pham, Hoang, Huynh, Vo, Dang, Bui, Do, Ngo, Duong, Ly, Truong
- Names appear in ALL CAPS on US tax documents and IDs
- Middle names are common: "NGUYEN THI HONG" (Nguyen=family, Thi=middle, Hong=given)
- When reasoning about names, note if format appears Vietnamese (affects data entry later)
- Some documents may have name variations (maiden name, married name) - note discrepancies
`

/**
 * Confidence calibration guidance
 * Ensures consistent confidence scoring across document types
 */
const CONFIDENCE_CALIBRATION = `
CONFIDENCE CALIBRATION:

HIGH CONFIDENCE (0.85-0.95):
- Form title/number clearly visible (e.g., "Form W-2", "1099-K")
- All key identifiers present (form boxes, labels, issuer info)
- Good image quality, no obstructions
- Never use confidence > 0.95 even if certain (AI humility)

MEDIUM CONFIDENCE (0.60-0.84):
- Most identifiers visible but some ambiguity
- Partial view of form (cropped edges)
- Some blur or low resolution
- Include alternativeTypes if plausible alternatives exist

LOW CONFIDENCE (< 0.60):
- Poor image quality, significant blur
- Only partial form visible
- Multiple document types possible
- Unusual format or non-standard document
- Use UNKNOWN if confidence would be < 0.30
`

/**
 * Generate the classification prompt with enhanced accuracy features
 */
export function getClassificationPrompt(): string {
  return `You are an expert document classifier for US tax preparation, specialized in processing documents for Vietnamese-American clients (nail salon owners, small business operators).

${FEW_SHOT_EXAMPLES}

DOCUMENT TYPES:

IDENTIFICATION DOCUMENTS:
- SSN_CARD: Social Security Card (blue/white card with 9-digit SSN)
- DRIVER_LICENSE: Driver's license or state ID card (has photo, license number)
- PASSPORT: US or foreign passport (has photo, passport number)

TAX FORMS - INCOME:
- W2: Form W-2 Wage and Tax Statement (employer-issued, shows wages Box 1, tax Box 2)
- FORM_1099_INT: Form 1099-INT Interest Income (from banks, interest in Box 1)
- FORM_1099_DIV: Form 1099-DIV Dividend Income (dividends in Box 1a/1b)
- FORM_1099_NEC: Form 1099-NEC Nonemployee Compensation (contractor income Box 1)
- FORM_1099_MISC: Form 1099-MISC Miscellaneous Income (rents Box 1, royalties Box 2)
- FORM_1099_K: Form 1099-K Payment Card Transactions (Square, Clover, PayPal - gross in Box 1a)
- FORM_1099_R: Form 1099-R Retirement Distributions (401k, IRA, pension withdrawals)
- FORM_1099_G: Form 1099-G Government Payments (unemployment, state tax refunds)
- FORM_1099_SSA: Form SSA-1099 Social Security Benefits (benefits in Box 5)
- SCHEDULE_K1: Schedule K-1 Partnership Income (Form 1065 or 1120S)

TAX FORMS - DEDUCTIONS/CREDITS:
- FORM_1098: Form 1098 Mortgage Interest Statement (mortgage interest Box 1)
- FORM_1098_T: Form 1098-T Tuition Statement (education credits)
- FORM_1095_A: Form 1095-A Health Insurance Marketplace Statement

BUSINESS DOCUMENTS:
- BANK_STATEMENT: Bank account statements (monthly/quarterly, shows transactions)
- PROFIT_LOSS_STATEMENT: Business P&L statements
- BUSINESS_LICENSE: Business license or registration certificate
- EIN_LETTER: IRS EIN assignment letter (CP 575, shows XX-XXXXXXX number)

TAX RETURNS - Filed Returns & Transcripts:
- FORM_1040: Form 1040 U.S. Individual Income Tax Return (multi-page, IRS logo, tax year header, filing status checkboxes, income summary Lines 1-15, AGI Line 11, total tax Line 24, refund Line 35a)
- FORM_1040_SR: Form 1040-SR Tax Return for Seniors (identical layout to 1040, "SR" designation in title, larger font, standard deduction chart for seniors)
- FORM_1040_NR: Form 1040-NR Nonresident Alien Income Tax Return ("Nonresident Alien" in title, Schedule OI for country of residence)
- FORM_1040_X: Form 1040-X Amended U.S. Individual Income Tax Return ("Amended" in title, 3-column layout comparing original vs. corrected values)
- STATE_TAX_RETURN: State income tax return (CA Form 540, NY IT-201, etc. — state logo/seal, state-specific tax lines, state agency name)
- FOREIGN_TAX_RETURN: Foreign country income tax return (non-US language/format, foreign government logo, foreign currency amounts)
- TAX_RETURN_TRANSCRIPT: IRS Tax Return Transcript (IRS letterhead, "Tax Return Transcript" header, masked SSN, line-by-line 1040 data without original format)

TAX RETURN SCHEDULES (Form 1040 Attachments):
- SCHEDULE_C: Schedule C - Profit or Loss From Business (Sole Proprietorship). Shows gross receipts Line 1, cost of goods sold Line 4, expenses Lines 8-27, net profit/loss Line 31. Has principal business code (6-digit NAICS).
- SCHEDULE_SE: Schedule SE - Self-Employment Tax. Calculates Social Security and Medicare tax for self-employed. Line 2 net profit from Schedule C, Line 6 total self-employment tax.
- SCHEDULE_1: Schedule 1 - Additional Income and Adjustments to Income. Part I: taxable refunds, business income (Schedule C), rental income (Schedule E), unemployment. Part II: educator expenses, HSA, self-employment tax deduction.
- SCHEDULE_D: Schedule D - Capital Gains and Losses. Part I short-term (held <=1 year), Part II long-term (held >1 year). References Form 8949 for transaction details. Line 16 combined net gain/loss.
- SCHEDULE_E: Schedule E - Supplemental Income and Loss. Part I: rental real estate (up to 3 properties), shows rental income Line 3, expenses Lines 5-19, depreciation Line 18, net income Line 21. Part II: partnership/S-corp income.

DISAMBIGUATION RULES FOR TAX RETURNS:
- 1040 vs 1040-X: Look for "Amended" in title or three-column layout (1040-X)
- 1040 vs 1040-SR: Look for "SR" in form number or "Seniors" in title
- 1040 vs State return: Federal returns have IRS logo; state returns have state agency branding
- 1040 vs Transcript: Transcripts are letters from IRS, not the actual form layout
- Tax return vs PRIOR_YEAR_RETURN: Use FORM_1040 (not PRIOR_YEAR_RETURN) when actual 1040 form is visible

DISAMBIGUATION RULES FOR SCHEDULES:
- Schedule C vs Profit/Loss Statement: Schedule C has IRS header "SCHEDULE C (Form 1040)"; business P&L has company letterhead
- Schedule D vs Form 8949: Schedule D summarizes totals; Form 8949 lists individual transactions
- Schedule E vs Schedule C: Schedule E = passive rental income; Schedule C = active business income
- Schedule 1 vs Form 1040: Schedule 1 is attachment showing additional income; Form 1040 is main return
- Schedule SE vs W-2: Schedule SE calculates self-employment tax; W-2 shows employer withholding

OTHER DOCUMENTS:
- RECEIPT: General receipts, invoices, purchase records
- BIRTH_CERTIFICATE: Birth certificate (for dependents)
- DAYCARE_RECEIPT: Childcare/daycare receipts or statements
- OTHER: Other document types not listed above

${VIETNAMESE_NAME_HANDLING}

${CONFIDENCE_CALIBRATION}

Respond in JSON format:
{"docType":"DOC_TYPE","confidence":0.XX,"reasoning":"Brief explanation referencing key identifiers","alternativeTypes":[],"taxYear":2025,"source":"Company Name","recipientName":"Person Name"}

EXTRACTION RULES FOR NAMING:
- taxYear: Extract from Box period, statement date, form header "Tax Year 20XX", or document date. Use null if unclear.
- source: Extract employer name (W2 Box c), bank name (1099-INT payer), issuer. Remove legal suffixes (case-insensitive): "Inc", "Inc.", "LLC", "Corp", "Corp.", "Corporation", "Co", "Co.", "Ltd", "Ltd.". Use null if not found or if only generic name remains.
- recipientName: Extract the person's name from the document:
  - W2: Employee name (Box e - Employee's first name and initial, Box f - Employee's last name)
  - 1099-NEC/MISC/K/R/G/B/S/C: Recipient's name
  - 1099-INT/DIV: Account holder's name
  - SSN_CARD: Name on card
  - DRIVER_LICENSE: Name on license
  - PASSPORT: Name on passport
  - Other documents: Person's name if clearly identifiable
  - Use null if no person name found or unclear

RULES:
1. Confidence 0-1 scale, be conservative (rarely use > 0.95)
2. Include alternativeTypes only if confidence < 0.80
3. Key identifiers: form numbers (1099-K, W-2), titles, logos, issuer names
4. For 1099 variants, ALWAYS verify the specific letter suffix (INT vs DIV vs NEC vs K vs R vs G)
5. If unclear or unreadable, use UNKNOWN with low confidence
6. Check for "CORRECTED" checkbox on any tax form
7. taxYear must be a 4-digit year between 2000-2100, or null
8. source should be clean company/entity name without legal suffixes`
}

/**
 * Validate classification result
 */
export function validateClassificationResult(
  result: unknown
): result is ClassificationResult {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>

  if (typeof r.docType !== 'string') return false
  if (typeof r.confidence !== 'number') return false
  if (typeof r.reasoning !== 'string') return false

  // Validate docType is valid
  const validTypes = [...SUPPORTED_DOC_TYPES, 'UNKNOWN']
  if (!validTypes.includes(r.docType as SupportedDocType)) return false

  // Validate confidence range
  if (r.confidence < 0 || r.confidence > 1) return false

  // Validate taxYear (optional, number or null)
  // Range 2000-2100 covers historical documents and future-proofs for 70+ years
  if ('taxYear' in r && r.taxYear !== null) {
    if (typeof r.taxYear !== 'number' || r.taxYear < 2000 || r.taxYear > 2100) {
      return false
    }
  }

  // Validate source (optional, non-empty string or null)
  // Treat empty strings as invalid - use null for missing source
  if ('source' in r && r.source !== null) {
    if (typeof r.source !== 'string' || r.source.trim() === '') {
      return false
    }
  }

  // Validate recipientName (optional, non-empty string or null)
  if ('recipientName' in r && r.recipientName !== null) {
    if (typeof r.recipientName !== 'string' || r.recipientName.trim() === '') {
      return false
    }
  }

  return true
}
