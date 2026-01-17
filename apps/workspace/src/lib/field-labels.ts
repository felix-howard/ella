/**
 * Field labels for document verification workflow
 * Maps extracted data field keys to English display labels
 * (English labels for OltPro Tax Software compatibility)
 * Used in VerificationModal and DataEntryModal
 */

// W2 form fields
const W2_FIELDS: Record<string, string> = {
  employerName: 'Employer Name',
  employerEIN: 'Employer EIN',
  employerAddress: 'Employer Address',
  wages: 'Box 1 - Wages',
  federalWithholding: 'Box 2 - Federal Tax Withheld',
  socialSecurityWages: 'Box 3 - SS Wages',
  socialSecurityTax: 'Box 4 - SS Tax',
  medicareWages: 'Box 5 - Medicare Wages',
  medicareTax: 'Box 6 - Medicare Tax',
  employeeSsn: 'Employee SSN',
  employeeName: 'Employee Name',
  employeeAddress: 'Employee Address',
  stateTax: 'State Tax',
  localTax: 'Local Tax',
}

// 1099-INT form fields
const FORM_1099_INT_FIELDS: Record<string, string> = {
  payerName: 'Payer Name',
  payerTin: 'Payer TIN',
  interestIncome: 'Box 1 - Interest Income',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-DIV form fields
const FORM_1099_DIV_FIELDS: Record<string, string> = {
  payerName: 'Payer Name',
  payerTin: 'Payer TIN',
  ordinaryDividends: 'Box 1a - Ordinary Dividends',
  qualifiedDividends: 'Box 1b - Qualified Dividends',
  capitalGain: 'Box 2a - Capital Gain',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-NEC form fields
const FORM_1099_NEC_FIELDS: Record<string, string> = {
  // Payer info
  payerName: 'Payer Name',
  payerAddress: 'Payer Address',
  payerTIN: 'Payer TIN',
  payerPhone: 'Payer Phone',
  // Recipient info
  recipientName: 'Recipient Name',
  recipientAddress: 'Recipient Address',
  recipientTIN: 'Recipient TIN/SSN',
  accountNumber: 'Account Number',
  // Boxes
  nonemployeeCompensation: 'Box 1 - Nonemployee Compensation',
  payerMadeDirectSales: 'Box 2 - Direct Sales >$5K',
  federalIncomeTaxWithheld: 'Box 4 - Federal Tax Withheld',
  // State info (flattened)
  state: 'Box 5 - State',
  statePayerStateNo: 'Box 6 - State/Payer ID',
  stateIncome: 'Box 7 - State Income',
  // Metadata
  taxYear: 'Tax Year',
  corrected: 'Corrected',
}

// 1099-MISC form fields
const FORM_1099_MISC_FIELDS: Record<string, string> = {
  payerName: 'Payer Name',
  payerTin: 'Payer TIN',
  rents: 'Box 1 - Rents',
  royalties: 'Box 2 - Royalties',
  otherIncome: 'Box 3 - Other Income',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-K form fields
const FORM_1099_K_FIELDS: Record<string, string> = {
  filerName: 'PSE/Filer Name',
  filerTin: 'PSE/Filer TIN',
  grossAmount: 'Box 1a - Gross Amount',
  cardTransactions: 'Card Transactions',
  paymentNetwork: 'Payment Network',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-R form fields (retirement distributions)
const FORM_1099_R_FIELDS: Record<string, string> = {
  payerName: 'Payer Name',
  payerTin: 'Payer TIN',
  grossDistribution: 'Box 1 - Gross Distribution',
  taxableAmount: 'Box 2a - Taxable Amount',
  federalWithholding: 'Box 4 - Federal Tax Withheld',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-G form fields (government payments)
const FORM_1099_G_FIELDS: Record<string, string> = {
  payerName: 'Payer Name',
  unemploymentCompensation: 'Box 1 - Unemployment',
  stateLocalRefund: 'Box 2 - State/Local Refund',
  federalWithholding: 'Box 4 - Federal Tax Withheld',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// 1099-SSA form fields (social security)
const FORM_1099_SSA_FIELDS: Record<string, string> = {
  benefitsReceived: 'Box 3 - Benefits Received',
  benefitsRepaid: 'Box 4 - Benefits Repaid',
  netBenefits: 'Box 5 - Net Benefits',
  federalWithholding: 'Box 6 - Federal Tax Withheld',
  recipientSsn: 'Recipient SSN',
  recipientName: 'Recipient Name',
}

// Identity document fields (SSN card, driver license, passport)
const IDENTITY_FIELDS: Record<string, string> = {
  name: 'Full Name',
  firstName: 'First Name',
  lastName: 'Last Name',
  middleName: 'Middle Name',
  ssn: 'SSN',
  address: 'Address',
  licenseNumber: 'License Number',
  passportNumber: 'Passport Number',
  expirationDate: 'Expiration Date',
  issueDate: 'Issue Date',
  dateOfBirth: 'Date of Birth',
  stateIssued: 'State Issued',
  countryIssued: 'Country Issued',
  sex: 'Sex',
}

// Business document fields
const BUSINESS_FIELDS: Record<string, string> = {
  businessName: 'Business Name',
  ein: 'EIN',
  dba: 'DBA',
  businessType: 'Business Type',
  businessAddress: 'Business Address',
}

// 1098 form fields (mortgage interest)
const FORM_1098_FIELDS: Record<string, string> = {
  lenderName: 'Lender Name',
  mortgageInterest: 'Box 1 - Mortgage Interest',
  realEstateTax: 'Box 2 - Real Estate Tax',
  mortgageInsurance: 'Box 5 - Mortgage Insurance',
  recipientSsn: 'Borrower SSN',
  recipientName: 'Borrower Name',
  propertyAddress: 'Property Address',
}

// 1098-T form fields (tuition)
const FORM_1098_T_FIELDS: Record<string, string> = {
  schoolName: 'School Name',
  schoolEin: 'School EIN',
  tuitionPaid: 'Box 1 - Tuition Paid',
  scholarships: 'Box 5 - Scholarships',
  adjustments: 'Box 4 - Adjustments',
  studentSsn: 'Student SSN',
  studentName: 'Student Name',
}

// Generic/fallback fields
const GENERIC_FIELDS: Record<string, string> = {
  amount: 'Amount',
  date: 'Date',
  description: 'Description',
  notes: 'Notes',
  total: 'Total',
  vendor: 'Vendor',
  category: 'Category',
}

/**
 * Doc-type-specific field labels map
 * Use getFieldLabelForDocType() for accurate labels per document type
 */
export const DOC_TYPE_FIELD_LABELS: Record<string, Record<string, string>> = {
  W2: W2_FIELDS,
  FORM_1099_INT: FORM_1099_INT_FIELDS,
  FORM_1099_DIV: FORM_1099_DIV_FIELDS,
  FORM_1099_NEC: FORM_1099_NEC_FIELDS,
  FORM_1099_MISC: FORM_1099_MISC_FIELDS,
  FORM_1099_K: FORM_1099_K_FIELDS,
  FORM_1099_R: FORM_1099_R_FIELDS,
  FORM_1099_G: FORM_1099_G_FIELDS,
  FORM_1099_SSA: FORM_1099_SSA_FIELDS,
  FORM_1098: FORM_1098_FIELDS,
  FORM_1098_T: FORM_1098_T_FIELDS,
  SSN_CARD: IDENTITY_FIELDS,
  DRIVER_LICENSE: IDENTITY_FIELDS,
  PASSPORT: IDENTITY_FIELDS,
  BIRTH_CERTIFICATE: IDENTITY_FIELDS,
  BUSINESS_LICENSE: BUSINESS_FIELDS,
  EIN_LETTER: BUSINESS_FIELDS,
}

/**
 * Combined field labels map - merges all document type fields
 * Priority: specific doc type fields > generic fields
 */
export const FIELD_LABELS: Record<string, string> = {
  ...GENERIC_FIELDS,
  ...W2_FIELDS,
  ...FORM_1099_INT_FIELDS,
  ...FORM_1099_DIV_FIELDS,
  ...FORM_1099_NEC_FIELDS,
  ...FORM_1099_MISC_FIELDS,
  ...FORM_1099_K_FIELDS,
  ...FORM_1099_R_FIELDS,
  ...FORM_1099_G_FIELDS,
  ...FORM_1099_SSA_FIELDS,
  ...IDENTITY_FIELDS,
  ...BUSINESS_FIELDS,
  ...FORM_1098_FIELDS,
  ...FORM_1098_T_FIELDS,
}

/**
 * Get label for a field key (generic lookup)
 * Falls back to the key itself if no label found
 * Formats camelCase to Title Case for unknown keys
 */
export function getFieldLabel(fieldKey: string): string {
  if (FIELD_LABELS[fieldKey]) {
    return FIELD_LABELS[fieldKey]
  }
  // Format camelCase to Title Case
  return fieldKey
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim()
}

/**
 * Get label for a field key specific to a document type
 * Falls back to generic label if doc-type-specific not found
 */
export function getFieldLabelForDocType(fieldKey: string, docType: string): string {
  const docTypeLabels = DOC_TYPE_FIELD_LABELS[docType]
  if (docTypeLabels && docTypeLabels[fieldKey]) {
    return docTypeLabels[fieldKey]
  }
  // Fallback to generic labels
  return getFieldLabel(fieldKey)
}

/**
 * Filter out metadata fields that shouldn't be shown in verification UI
 */
export const EXCLUDED_FIELDS = ['aiConfidence', 'rawText', 'confidence', 'documentType']

/**
 * Check if a field should be excluded from verification
 */
export function isExcludedField(fieldKey: string): boolean {
  return EXCLUDED_FIELDS.includes(fieldKey)
}
