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
  'MARRIAGE_CERTIFICATE',
  'DIVORCE_DECREE',
  'GREEN_CARD',
  'WORK_VISA',
  'NATURALIZATION_CERTIFICATE',
  'POWER_OF_ATTORNEY',

  // Employment Income
  'W2',
  'W2G',
  'PAY_STUB',
  'EMPLOYMENT_CONTRACT',
  'STOCK_OPTION_AGREEMENT',
  'RSU_STATEMENT',
  'ESPP_STATEMENT',

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
  'FORM_1099_A',
  'FORM_1099_CAP',
  'FORM_1099_H',
  'FORM_1099_LS',
  'FORM_1099_LTC',
  'FORM_1099_OID',
  'FORM_1099_PATR',
  'FORM_1099_QA',
  'FORM_1099_SB',
  'RRB_1099',
  'RRB_1099_R',

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
  'PARTNERSHIP_AGREEMENT',
  'SHAREHOLDER_AGREEMENT',
  'BUSINESS_INVOICE',
  'ACCOUNTS_RECEIVABLE',
  'ACCOUNTS_PAYABLE',
  'INVENTORY_REPORT',
  'SALES_TAX_REPORT',

  // Receipts & Supporting Docs
  'RECEIPT',
  'DAYCARE_RECEIPT',
  'CHARITY_RECEIPT',
  'MEDICAL_RECEIPT',
  'PROPERTY_TAX_STATEMENT',
  'ESTIMATED_TAX_PAYMENT',
  'RENT_RECEIPT',

  // Prior Year / IRS
  'PRIOR_YEAR_RETURN',
  'IRS_NOTICE',

  // Crypto
  'CRYPTO_STATEMENT',
  'CRYPTO_TAX_REPORT',
  'CRYPTO_TRANSACTION_HISTORY',
  'STAKING_REWARDS',

  // Foreign
  'FOREIGN_BANK_STATEMENT',
  'FOREIGN_TAX_STATEMENT',
  'FBAR_SUPPORT_DOCS',
  'FORM_8938',

  // Real Estate / Home Sale
  'CLOSING_DISCLOSURE',
  'LEASE_AGREEMENT',
  'HUD_1',
  'PROPERTY_DEED',
  'HOME_APPRAISAL',
  'PMI_STATEMENT',

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
  'SCHEDULE_2',
  'SCHEDULE_3',
  'SCHEDULE_A',
  'SCHEDULE_B',
  'SCHEDULE_EIC',
  'SCHEDULE_F',
  'SCHEDULE_H',
  'SCHEDULE_J',
  'SCHEDULE_R',
  'SCHEDULE_8812',

  // Critical IRS Forms
  'FORM_2210',
  'FORM_2441',
  'FORM_2555',
  'FORM_3903',
  'FORM_4562',
  'FORM_4684',
  'FORM_4797',
  'FORM_4868',
  'FORM_5329',
  'FORM_5695',
  'FORM_6251',
  'FORM_8283',
  'FORM_8379',
  'FORM_8582',
  'FORM_8606',
  'FORM_8829',
  'FORM_8863',
  'FORM_8880',
  'FORM_8889',
  'FORM_8936',
  'FORM_8949',
  'FORM_8959',
  'FORM_8960',
  'FORM_8962',
  'FORM_8995',
  'FORM_8995_A',

  // Investment Documents
  'BROKERAGE_STATEMENT',
  'TRADE_CONFIRMATION',
  'COST_BASIS_STATEMENT',
  'MUTUAL_FUND_STATEMENT',
  'DIVIDEND_REINVESTMENT',

  // Retirement Documents
  'PENSION_STATEMENT',
  'IRA_STATEMENT',
  'STATEMENT_401K',
  'ROTH_IRA_STATEMENT',
  'RMD_STATEMENT',

  // Healthcare Documents
  'MEDICAL_BILL',
  'INSURANCE_EOB',
  'HSA_STATEMENT',
  'FSA_STATEMENT',

  // Insurance Documents
  'AUTO_INSURANCE',
  'HOME_INSURANCE',
  'LIFE_INSURANCE_STATEMENT',
  'DISABILITY_INSURANCE',

  // Legal Documents
  'COURT_ORDER',
  'SETTLEMENT_AGREEMENT',
  'ALIMONY_AGREEMENT',
  'CHILD_SUPPORT_ORDER',
  'BANKRUPTCY_DOCUMENTS',

  // Childcare Documents
  'DAYCARE_STATEMENT',
  'DEPENDENT_CARE_FSA',
  'NANNY_DOCUMENTATION',

  // Gambling Documents
  'GAMBLING_LOSS_STATEMENT',

  // Miscellaneous Documents
  'BANK_LETTER',
  'LOAN_STATEMENT',
  'MEMBERSHIP_DUES',
  'PROFESSIONAL_LICENSE',

  // Other
  'OTHER',
  'UNKNOWN',
] as const

export type SupportedDocType = (typeof SUPPORTED_DOC_TYPES)[number]

/**
 * Page marker extracted from document (e.g., "Page 2 of 3", "Part IV")
 */
export interface PageMarker {
  current: number | null  // "Page 2 of 3" → 2
  total: number | null    // "Page 2 of 3" → 3
  partNumber: string | null  // "Part IV" → "IV"
}

/**
 * Continuation marker for supplemental pages (e.g., "Line 19 (2210)")
 */
export interface ContinuationMarker {
  type: 'line-reference' | 'attachment' | 'see-attached' | null
  parentForm: string | null  // "Line 19 (2210)" → "FORM_2210"
  lineNumber: string | null  // "Line 19 (2210)" → "19"
}

/**
 * Extracted metadata for hierarchical clustering
 * Used by Phase 2 grouping algorithm to bucket documents
 */
export interface ExtractedMetadata {
  taxpayerName: string | null      // Primary person's name on document
  ssn4: string | null              // Last 4 digits of SSN (e.g., "1234")
  pageMarker: PageMarker | null    // Page/Part indicators
  continuationMarker: ContinuationMarker | null  // Attachment/continuation indicators
}

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
  // Metadata for hierarchical clustering (Phase 1 grouping redesign)
  extractedMetadata?: ExtractedMetadata
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

EXAMPLE 11 - Form 5695 (Residential Energy Credits):
Image shows: "Form 5695" title, "Residential Energy Credits" subtitle, Part I for nonbusiness energy property, Part II for residential energy efficient property, Line 13 total credits
Response: {"docType":"FORM_5695","confidence":0.91,"reasoning":"Form 5695 identified by 'Residential Energy Credits' header, has solar/wind/geothermal sections in Part II, total credit calculation","taxYear":2024}

EXAMPLE 12 - Form 8962 (Premium Tax Credit):
Image shows: "Form 8962" title, "Premium Tax Credit (PTC)" subtitle, Part I annual/monthly amounts, Part II-III marketplace information, reconciliation of advance payments
Response: {"docType":"FORM_8962","confidence":0.90,"reasoning":"Form 8962 with Premium Tax Credit header, references Form 1095-A data, has PTC reconciliation sections","taxYear":2024}

EXAMPLE 13 - Form 4562 (Depreciation):
Image shows: "Form 4562" title, "Depreciation and Amortization" subtitle, Part I Section 179 deduction, Part II special depreciation allowance, Part III MACRS depreciation, asset listings
Response: {"docType":"FORM_4562","confidence":0.92,"reasoning":"Form 4562 identified by depreciation sections, Section 179 election area, MACRS tables, attached to Schedule C or E","taxYear":2024}

EXAMPLE 14 - Form 8949 (Capital Asset Sales):
Image shows: "Form 8949" title, "Sales and Other Dispositions of Capital Assets" subtitle, checkbox for 1099-B reporting, Part I short-term (A/B/C), Part II long-term (D/E/F), columns for description/date acquired/date sold/proceeds/cost basis/gain or loss
Response: {"docType":"FORM_8949","confidence":0.91,"reasoning":"Form 8949 with individual transaction rows, references Schedule D, has checkbox for 1099-B basis reporting type","taxYear":2024}

EXAMPLE 15 - Schedule A (Itemized Deductions):
Image shows: "SCHEDULE A (Form 1040)" header, "Itemized Deductions" subtitle, sections for medical expenses, state/local taxes, mortgage interest, charitable contributions, casualty losses
Response: {"docType":"SCHEDULE_A","confidence":0.92,"reasoning":"Schedule A with itemized deduction categories, medical expense threshold calculation, SALT limitation reference","taxYear":2024}

EXAMPLE 16 - W-2 with extractedMetadata:
Image shows: Form W-2, Employee name "NGUYEN VAN ANH", SSN "XXX-XX-1234", employer "ABC NAIL SALON LLC"
Response: {"docType":"W2","confidence":0.93,"reasoning":"W-2 with visible employee name and SSN-4","taxYear":2024,"source":"ABC Nail Salon","recipientName":"NGUYEN VAN ANH","extractedMetadata":{"taxpayerName":"NGUYEN VAN ANH","ssn4":"1234","pageMarker":null,"continuationMarker":null}}

EXAMPLE 17 - Schedule C continuation page:
Image shows: "SCHEDULE C" header, "Page 2 of 2", "See attached" text at line 30, expenses listing continues from page 1
Response: {"docType":"SCHEDULE_C","confidence":0.90,"reasoning":"Schedule C page 2 with continuation marker","taxYear":2024,"extractedMetadata":{"taxpayerName":"JOHN DOE","ssn4":"5678","pageMarker":{"current":2,"total":2,"partNumber":null},"continuationMarker":{"type":"see-attached","parentForm":null,"lineNumber":"30"}}}

EXAMPLE 18 - Form 2210 underpayment penalty supplement:
Image shows: "Underpayment of Estimated Tax", "Line 19 (2210)" reference, supporting calculation worksheet
Response: {"docType":"FORM_2210","confidence":0.88,"reasoning":"Form 2210 supplement with line reference","taxYear":2024,"extractedMetadata":{"taxpayerName":"MARY SMITH","ssn4":null,"pageMarker":null,"continuationMarker":{"type":"line-reference","parentForm":"FORM_2210","lineNumber":"19"}}}
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
- BIRTH_CERTIFICATE: Birth certificate (for dependents)
- ITIN_LETTER: IRS ITIN assignment letter (9XX-XX-XXXX format)
- MARRIAGE_CERTIFICATE: Marriage certificate for filing status
- DIVORCE_DECREE: Divorce decree for filing status changes
- GREEN_CARD: Permanent resident card (I-551)
- WORK_VISA: Employment authorization (H1B, L1, etc.)
- NATURALIZATION_CERTIFICATE: Certificate of naturalization (N-550/N-570)
- POWER_OF_ATTORNEY: POA documents (Form 2848 or legal POA)

TAX FORMS - INCOME:
- W2: Form W-2 Wage and Tax Statement (employer-issued, shows wages Box 1, tax Box 2)
- W2G: Form W-2G Gambling Winnings (casino winnings, lottery prizes)
- PAY_STUB: Pay stub/paycheck statement (not W-2, shows gross pay, deductions)
- FORM_1099_INT: Form 1099-INT Interest Income (from banks, interest in Box 1)
- FORM_1099_DIV: Form 1099-DIV Dividend Income (dividends in Box 1a/1b)
- FORM_1099_NEC: Form 1099-NEC Nonemployee Compensation (contractor income Box 1)
- FORM_1099_MISC: Form 1099-MISC Miscellaneous Income (rents Box 1, royalties Box 2)
- FORM_1099_K: Form 1099-K Payment Card Transactions (Square, Clover, PayPal - gross in Box 1a)
- FORM_1099_R: Form 1099-R Retirement Distributions (401k, IRA, pension withdrawals)
- FORM_1099_G: Form 1099-G Government Payments (unemployment, state tax refunds)
- FORM_1099_SSA: Form SSA-1099 Social Security Benefits (benefits in Box 5)
- FORM_1099_B: Form 1099-B Broker Sales (stock/securities sales, cost basis)
- FORM_1099_S: Form 1099-S Real Estate Proceeds (home/property sales)
- FORM_1099_C: Form 1099-C Cancellation of Debt (forgiven debt as income)
- FORM_1099_A: Form 1099-A Acquisition/Abandonment of Property
- FORM_1099_OID: Form 1099-OID Original Issue Discount (bond discount)
- FORM_1099_LTC: Form 1099-LTC Long-Term Care Benefits
- RRB_1099: Railroad Retirement Form RRB-1099
- RRB_1099_R: Railroad Retirement Form RRB-1099-R (annuity)
- SCHEDULE_K1: Schedule K-1 Partnership Income (Form 1065 or 1120S)

TAX FORMS - DEDUCTIONS/CREDITS:
- FORM_1098: Form 1098 Mortgage Interest Statement (mortgage interest Box 1)
- FORM_1098_T: Form 1098-T Tuition Statement (education credits)
- FORM_1098_E: Form 1098-E Student Loan Interest (interest paid Box 1)
- FORM_1095_A: Form 1095-A Health Insurance Marketplace Statement
- FORM_1095_B: Form 1095-B Health Coverage (employer/insurer provided)
- FORM_1095_C: Form 1095-C Employer Health Coverage (ALE reporting)
- FORM_5498_SA: Form 5498-SA HSA Contributions (HSA/MSA contributions)

CRITICAL IRS FORMS (Schedules & Credits):
- FORM_5695: Form 5695 Residential Energy Credits (solar, wind, geothermal - Part I nonbusiness, Part II qualified property)
- FORM_8962: Form 8962 Premium Tax Credit (reconciles 1095-A marketplace coverage)
- FORM_4562: Form 4562 Depreciation & Amortization (Section 179, MACRS depreciation tables)
- FORM_8949: Form 8949 Sales of Capital Assets (individual transaction detail, feeds Schedule D)
- FORM_2441: Form 2441 Child Care Expenses (dependent care credit)
- FORM_8829: Form 8829 Home Office Expenses (home business use percentage)
- FORM_8863: Form 8863 Education Credits (AOTC, Lifetime Learning)
- FORM_8889: Form 8889 HSA Deduction (HSA contributions and distributions)
- FORM_8995: Form 8995 QBI Deduction (Qualified Business Income - simple)
- FORM_8995_A: Form 8995-A QBI Deduction (Complex - multiple businesses)
- FORM_8606: Form 8606 Nondeductible IRAs (basis tracking)
- FORM_6251: Form 6251 Alternative Minimum Tax (AMT calculation)

BUSINESS DOCUMENTS:
- BANK_STATEMENT: Bank account statements (monthly/quarterly, shows transactions)
- PROFIT_LOSS_STATEMENT: Business P&L statements (company letterhead, not IRS form)
- BUSINESS_LICENSE: Business license or registration certificate
- EIN_LETTER: IRS EIN assignment letter (CP 575, shows XX-XXXXXXX number)
- PARTNERSHIP_AGREEMENT: Partnership operating agreement
- SHAREHOLDER_AGREEMENT: S-Corp/C-Corp shareholder agreement
- BUSINESS_INVOICE: Business invoice sent to customers
- SALES_TAX_REPORT: State sales tax filings

INVESTMENT DOCUMENTS:
- BROKERAGE_STATEMENT: Brokerage account statement (holdings, transactions)
- TRADE_CONFIRMATION: Individual trade confirmations (buy/sell)
- COST_BASIS_STATEMENT: Cost basis report from broker
- MUTUAL_FUND_STATEMENT: Mutual fund account statement
- CRYPTO_TAX_REPORT: Cryptocurrency tax report (8949 format from exchanges)
- CRYPTO_TRANSACTION_HISTORY: Raw crypto transaction history

RETIREMENT DOCUMENTS:
- PENSION_STATEMENT: Pension benefit statement (not 1099-R)
- IRA_STATEMENT: IRA account statement (balance, contributions)
- STATEMENT_401K: 401(k) account statement (balance, contributions)
- ROTH_IRA_STATEMENT: Roth IRA account statement
- RMD_STATEMENT: Required Minimum Distribution statement

REAL ESTATE DOCUMENTS:
- CLOSING_DISCLOSURE: HUD Closing Disclosure (home purchase/sale)
- HUD_1: HUD-1 Settlement Statement (older format)
- LEASE_AGREEMENT: Rental lease contract
- PROPERTY_DEED: Property deed/title
- HOME_APPRAISAL: Property appraisal report
- PROPERTY_TAX_STATEMENT: Property tax bill/statement
- PMI_STATEMENT: Private Mortgage Insurance statement

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
- Schedule A vs receipts: Schedule A is IRS form for itemized deductions; receipts are source docs
- Schedule 8812 vs Form 8812: Same form - use SCHEDULE_8812 for Additional Child Tax Credit

DISAMBIGUATION RULES FOR CREDITS/DEDUCTIONS:
- Form 5695 vs ENERGY_CREDIT_INVOICE: Form 5695 is IRS form; invoice is purchase receipt
- Form 8962 vs Form 1095-A: Form 8962 calculates PTC; Form 1095-A reports marketplace coverage
- Form 4562 vs DEPRECIATION_SCHEDULE: Form 4562 is IRS form; depreciation schedule is supporting doc
- Form 8949 vs BROKERAGE_STATEMENT: Form 8949 is IRS form; brokerage statement is source doc
- Form 2441 vs DAYCARE_RECEIPT: Form 2441 calculates credit; receipt is source doc

DISAMBIGUATION RULES FOR 1099 VARIANTS:
- 1099-INT vs 1099-DIV: INT = interest only; DIV = dividends (may include interest)
- 1099-K vs 1099-NEC: 1099-K from payment processors (Square, PayPal); 1099-NEC from payer company
- 1099-R vs RRB-1099-R: 1099-R from retirement plans; RRB from Railroad Retirement
- 1099-B vs BROKERAGE_STATEMENT: 1099-B is tax form; brokerage statement is account summary
- 1099-SSA vs RRB-1099: SSA from Social Security; RRB from Railroad Retirement

DISAMBIGUATION RULES FOR IDENTITY DOCS:
- SSN_CARD vs ITIN_LETTER: SSN has 9-digit XXX-XX-XXXX; ITIN starts with 9 (9XX-XX-XXXX)
- GREEN_CARD vs WORK_VISA: Green card is permanent; visa is temporary authorization
- PASSPORT vs DRIVER_LICENSE: Passport for travel/citizenship; DL for state ID

HEALTHCARE DOCUMENTS:
- MEDICAL_BILL: Medical bills/invoices (hospital, doctor charges)
- INSURANCE_EOB: Explanation of Benefits from insurer
- HSA_STATEMENT: HSA account statement (not Form 5498-SA)
- FSA_STATEMENT: FSA account statement

LEGAL DOCUMENTS:
- COURT_ORDER: Court orders (custody, support)
- ALIMONY_AGREEMENT: Alimony/spousal support agreement
- CHILD_SUPPORT_ORDER: Child support order
- SETTLEMENT_AGREEMENT: Legal settlement documents
- BANKRUPTCY_DOCUMENTS: Bankruptcy filings

CHILDCARE DOCUMENTS:
- DAYCARE_STATEMENT: Daycare/childcare provider statement (EIN, amount paid)
- DAYCARE_RECEIPT: Individual daycare receipts
- DEPENDENT_CARE_FSA: Dependent Care FSA statement
- NANNY_DOCUMENTATION: Nanny employment records (W-2/W-4, payments)

OTHER DOCUMENTS:
- RECEIPT: General receipts, invoices, purchase records
- BIRTH_CERTIFICATE: Birth certificate (for dependents)
- DAYCARE_RECEIPT: Childcare/daycare receipts or statements
- OTHER: Other document types not listed above

${VIETNAMESE_NAME_HANDLING}

${CONFIDENCE_CALIBRATION}

Respond in JSON format:
{"docType":"DOC_TYPE","confidence":0.XX,"reasoning":"Brief explanation referencing key identifiers","alternativeTypes":[],"taxYear":2025,"source":"Company Name","recipientName":"Person Name","extractedMetadata":{"taxpayerName":"NGUYEN VAN ANH","ssn4":"1234","pageMarker":{"current":2,"total":3,"partNumber":null},"continuationMarker":null}}

METADATA EXTRACTION (for hierarchical grouping):

Extract the following for document clustering:

1. taxpayerName: Primary person's name on document
   - W2: Employee name (Box e/f)
   - 1099: Recipient's name
   - Tax returns: "Your first name and middle initial" + "Last name"
   - Schedule C: "Proprietor name"
   - Use null if unclear or business entity name only

2. ssn4: Last 4 digits of SSN/EIN
   - Extract from "XXX-XX-1234" format
   - Only last 4 digits as string (e.g., "1234")
   - Use null if not visible or fully redacted

3. pageMarker: Page/Part indicators
   - Extract from "Page X of Y", "X/Y", "Part N" patterns
   - current: page number or null
   - total: total pages or null
   - partNumber: Roman numeral (e.g., "IV") or null

4. continuationMarker: Attachment/continuation indicators
   - type: "line-reference" if "Line X (FormNum)"
   - type: "attachment" if "Attachment Sheet X"
   - type: "see-attached" if "See attached", "See continuation"
   - parentForm: referenced form type (e.g., "FORM_2210")
   - lineNumber: referenced line (e.g., "19")

extractedMetadata is REQUIRED for tax documents with >80% confidence.

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

  // Validate extractedMetadata (optional but structured if present)
  if ('extractedMetadata' in r && r.extractedMetadata !== null && r.extractedMetadata !== undefined) {
    const meta = r.extractedMetadata as Record<string, unknown>

    // taxpayerName: optional string or null
    if ('taxpayerName' in meta && meta.taxpayerName !== null) {
      if (typeof meta.taxpayerName !== 'string') return false
    }

    // ssn4: optional 4-digit string or null
    // Reject placeholder patterns like "0000", "XXXX"
    if ('ssn4' in meta && meta.ssn4 !== null) {
      if (typeof meta.ssn4 !== 'string' || !/^\d{4}$/.test(meta.ssn4)) return false
      // Reject placeholder values (fully masked or zeros)
      if (meta.ssn4 === '0000' || /^(\d)\1{3}$/.test(meta.ssn4)) return false
    }

    // pageMarker: optional object or null
    if ('pageMarker' in meta && meta.pageMarker !== null) {
      const pm = meta.pageMarker as Record<string, unknown>
      if (typeof pm !== 'object') return false
      if ('current' in pm && pm.current !== null && typeof pm.current !== 'number') return false
      if ('total' in pm && pm.total !== null && typeof pm.total !== 'number') return false
      if ('partNumber' in pm && pm.partNumber !== null && typeof pm.partNumber !== 'string') return false
    }

    // continuationMarker: optional object or null
    if ('continuationMarker' in meta && meta.continuationMarker !== null) {
      const cm = meta.continuationMarker as Record<string, unknown>
      if (typeof cm !== 'object') return false
      if ('type' in cm && cm.type !== null) {
        if (!['line-reference', 'attachment', 'see-attached'].includes(cm.type as string)) return false
      }
      if ('parentForm' in cm && cm.parentForm !== null && typeof cm.parentForm !== 'string') return false
      if ('lineNumber' in cm && cm.lineNumber !== null && typeof cm.lineNumber !== 'string') return false
    }
  }

  return true
}

// ============================================
// SMART RENAME - FALLBACK FOR UNCLASSIFIABLE DOCS
// ============================================

/**
 * PageInfo for multi-page detection (Phase 3 preparation)
 */
export interface PageInfo {
  isMultiPage: boolean
  currentPage: number | null
  totalPages: number | null
  continuationMarker: string | null
  documentIdentifier: string | null
}

/**
 * SmartRename result structure for fallback naming
 */
export interface SmartRenameResult {
  documentTitle: string
  taxYear: number | null
  source: string | null
  recipientName: string | null
  pageInfo: PageInfo
  suggestedFilename: string
  confidence: number
  reasoning: string
}

/**
 * Fallback smart rename prompt
 * Used when document can't be classified to predefined type (<60% confidence)
 */
export function getSmartRenamePrompt(): string {
  return `You are analyzing a document that couldn't be classified into a predefined type.
Your ONLY job is to generate a meaningful, descriptive filename.

ANALYZE AND EXTRACT:
1. documentTitle: What IS this document? Be specific.
   - Good: "BankStatement", "PropertyTaxBill", "InsuranceEOB", "CourtOrder"
   - Bad: "Document", "Paper", "Form", "Letter"

2. taxYear: What year? Look for:
   - Statement periods ("January 2024 - December 2024")
   - Tax year references ("Tax Year 2024")
   - Document dates
   - Default to current year if truly unclear

3. source: Who issued this?
   - Company name (Chase, Wells Fargo, Blue Cross)
   - Government agency (IRS, Texas DMV, Harris County)
   - Person/entity name if applicable

4. recipientName: Whose document is this?
   - Account holder name
   - Taxpayer name
   - Property owner name

5. pageInfo: Multi-page document?
   - Look for "Page X of Y", "Continued", page numbers
   - Note if this appears to be part of a larger document

RESPONSE FORMAT (JSON):
{
  "documentTitle": "PropertyTaxBill",
  "taxYear": 2024,
  "source": "HarrisCounty",
  "recipientName": "JohnNguyen",
  "pageInfo": {
    "isMultiPage": false,
    "currentPage": null,
    "totalPages": null,
    "continuationMarker": null,
    "documentIdentifier": null
  },
  "suggestedFilename": "2024_PropertyTaxBill_HarrisCounty_JohnNguyen",
  "confidence": 0.85,
  "reasoning": "Property tax statement from Harris County Appraisal District for 2024"
}

NAMING RULES:
- Max 60 characters
- No spaces (use PascalCase or underscores)
- No special characters except underscores
- Be descriptive, not generic
- Include year, source, and name when available
- Format: YYYY_DocumentTitle_Source_RecipientName`
}

/**
 * Validate SmartRename result structure
 */
export function validateSmartRenameResult(result: unknown): result is SmartRenameResult {
  if (!result || typeof result !== 'object') return false
  const r = result as Record<string, unknown>

  // Required string fields
  if (typeof r.documentTitle !== 'string' || r.documentTitle.trim() === '') return false
  if (typeof r.suggestedFilename !== 'string' || r.suggestedFilename.trim() === '') return false
  if (typeof r.reasoning !== 'string') return false

  // Required number field
  if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) return false

  // Optional fields (can be null)
  if ('taxYear' in r && r.taxYear !== null) {
    if (typeof r.taxYear !== 'number' || r.taxYear < 2000 || r.taxYear > 2100) {
      return false
    }
  }

  if ('source' in r && r.source !== null) {
    if (typeof r.source !== 'string') return false
  }

  if ('recipientName' in r && r.recipientName !== null) {
    if (typeof r.recipientName !== 'string') return false
  }

  // pageInfo validation (optional but structured if present)
  if ('pageInfo' in r && r.pageInfo !== null) {
    const p = r.pageInfo as Record<string, unknown>
    if (typeof p !== 'object') return false
    if (typeof p.isMultiPage !== 'boolean') return false
  }

  return true
}

// ============================================
// MULTI-PAGE DOCUMENT GROUPING (Phase 3)
// ============================================

/**
 * Multi-page document grouping prompt
 * Compares new document against candidates to find related pages
 */
export function getGroupingAnalysisPrompt(candidateCount: number): string {
  return `You are comparing a NEW document (first image) against ${candidateCount} existing documents.
Determine if the NEW document belongs with any of the existing documents as part of the same multi-page document.

CRITICAL RULE - SAME FORM TYPE REQUIRED:
- Documents MUST be the same form type/number to be grouped
- Form 1040 pages can ONLY group with other Form 1040 pages
- Schedule C pages can ONLY group with other Schedule C pages
- NEVER group: Form 1040 + Schedule EIC (different forms, same taxpayer)
- NEVER group: W-2 + 1099-NEC (different income forms, same person)
- Same taxpayer name is NOT sufficient - form type must match

REQUIRED FOR GROUPING (ALL must be true):
1. SAME form number/title - THIS IS MANDATORY (e.g., all show "Form 4562")
2. Same person's name and identifying info (SSN, address, account #)
3. Page numbers indicating continuation (Page 2 of 3)
4. "Continued" markers or references to other pages
5. Same letterhead, formatting, visual style
6. Sequential content (tables continue, numbers progress)
7. Same document identifier (case #, account #, policy #)

NEGATIVE EXAMPLES (DO NOT GROUP):
- Form 1040 page 1 + Schedule C → Different form types, do not group
- Form 4562 + Schedule E → Different form types, do not group
- W-2 from Employer A + W-2 from Employer B → Different sources, do not group
- Form 1040 + Schedule EIC → Different forms for same taxpayer, do not group

INDICATORS OF DIFFERENT DOCUMENTS (any of these = do NOT group):
1. Different form types (W-2 vs 1099, Form 1040 vs Schedule C)
2. Different dates/years
3. Different names/entities
4. Completely different content/purpose
5. Different visual style/format

PAGE ORDER DETERMINATION:
1. FIRST: Look for explicit page numbers ("Page X of Y", "1/3", "2/3")
2. SECOND: Look for continuation markers ("Continued from page 1")
3. THIRD: Look for sequential content (tables continuing, numbered items)
4. FOURTH: Look for header page vs detail pages (summary page usually first)

ORDERING EXAMPLES:
- Document with "Page 2 of 3" in footer → This is page 2
- Document with "Continued" at top → This is NOT page 1
- Document with totals/summary → Usually the LAST page
- Document with headers only, no data → Usually the FIRST page

pageOrder MUST reflect actual content order, NOT upload order or image index.
The "existing_doc_0" label is just an identifier - determine its TRUE page position from content.

RESPONSE FORMAT (JSON):
{
  "matchFound": true,
  "matchedIndices": [0, 2],
  "confidence": 0.92,
  "groupName": "Form4562_Depreciation_JohnDoe",
  "pageOrder": ["existing_doc_0", "new_doc", "existing_doc_2"],
  "reasoning": "All three documents show Form 4562 header with same taxpayer John Doe, pages 1-3"
}

If no match found:
{
  "matchFound": false,
  "matchedIndices": [],
  "confidence": 0,
  "groupName": null,
  "pageOrder": [],
  "reasoning": "New document is Schedule C, existing docs are W-2 and 1099-NEC - different form types cannot be grouped"
}

RULES:
- Only match if confident (>80%) they belong together
- SAME FORM TYPE IS MANDATORY - never group different form types
- pageOrder must be based on CONTENT (page numbers, continuation markers), not image index
- The new document could be ANY page (first, middle, or last)
- matchedIndices are 0-based indices of existing docs that match (not including new doc)
- pageOrder uses: "existing_doc_N" for existing docs, "new_doc" for the new document
- groupName should be descriptive: FormType_Description_PersonName (max 50 chars, no spaces)`
}

/**
 * Grouping analysis result from AI
 */
export interface GroupingAnalysisResult {
  matchFound: boolean
  matchedIndices: number[]
  confidence: number
  groupName: string | null
  pageOrder: string[]
  reasoning: string
}

/**
 * Validate GroupingAnalysisResult structure
 */
export function validateGroupingResult(result: unknown): result is GroupingAnalysisResult {
  if (!result || typeof result !== 'object') return false
  const r = result as Record<string, unknown>

  if (typeof r.matchFound !== 'boolean') return false
  if (!Array.isArray(r.matchedIndices)) return false
  if (typeof r.confidence !== 'number') return false
  if (!Array.isArray(r.pageOrder)) return false
  if (typeof r.reasoning !== 'string') return false

  // Validate matchedIndices contains only numbers
  if (!r.matchedIndices.every((idx) => typeof idx === 'number')) return false

  // Validate pageOrder contains only strings
  if (!r.pageOrder.every((p) => typeof p === 'string')) return false

  // Validate confidence range
  if (r.confidence < 0 || r.confidence > 1) return false

  // groupName can be string or null
  if (r.groupName !== null && typeof r.groupName !== 'string') return false

  return true
}
