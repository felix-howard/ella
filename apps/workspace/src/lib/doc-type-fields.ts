/**
 * DOC_TYPE_FIELDS - Maps document types to their expected fields
 * Used for field selection in ReUploadRequestModal and verification workflows
 * Field keys match extractedData keys from OCR processing
 */

/**
 * Fields for each document type
 * Keys match the DocType enum, values are arrays of field keys
 */
export const DOC_TYPE_FIELDS: Record<string, string[]> = {
  // Income documents
  W2: [
    'employerName',
    'employerEIN',
    'employerAddress',
    'employeeName',
    'employeeSsn',
    'employeeAddress',
    'wages',
    'federalWithholding',
    'socialSecurityWages',
    'socialSecurityTax',
    'medicareWages',
    'medicareTax',
    'stateTax',
    'localTax',
  ],

  FORM_1099_INT: [
    'payerName',
    'payerTin',
    'recipientName',
    'recipientSsn',
    'interestIncome',
  ],

  FORM_1099_DIV: [
    'payerName',
    'payerTin',
    'recipientName',
    'recipientSsn',
    'ordinaryDividends',
    'qualifiedDividends',
    'capitalGain',
  ],

  FORM_1099_NEC: [
    'payerName',
    'payerTin',
    'recipientName',
    'recipientSsn',
    'nonemployeeCompensation',
  ],

  FORM_1099_MISC: [
    'payerName',
    'payerTin',
    'recipientName',
    'recipientSsn',
    'rents',
    'royalties',
    'otherIncome',
  ],

  FORM_1099_K: [
    'filerName',
    'filerTin',
    'recipientName',
    'recipientSsn',
    'grossAmount',
    'cardTransactions',
    'paymentNetwork',
  ],

  FORM_1099_R: [
    'payerName',
    'payerTin',
    'recipientName',
    'recipientSsn',
    'grossDistribution',
    'taxableAmount',
    'federalWithholding',
  ],

  FORM_1099_G: [
    'payerName',
    'recipientName',
    'recipientSsn',
    'unemploymentCompensation',
    'stateLocalRefund',
    'federalWithholding',
  ],

  FORM_1099_SSA: [
    'recipientName',
    'recipientSsn',
    'benefitsReceived',
    'benefitsRepaid',
    'netBenefits',
    'federalWithholding',
  ],

  // Deduction documents
  FORM_1098: [
    'lenderName',
    'recipientName',
    'recipientSsn',
    'propertyAddress',
    'mortgageInterest',
    'realEstateTax',
    'mortgageInsurance',
  ],

  FORM_1098_T: [
    'schoolName',
    'schoolEin',
    'studentName',
    'studentSsn',
    'tuitionPaid',
    'scholarships',
    'adjustments',
  ],

  // Identity documents
  SSN_CARD: [
    'name',
    'ssn',
  ],

  DRIVER_LICENSE: [
    'name',
    'firstName',
    'lastName',
    'address',
    'licenseNumber',
    'expirationDate',
    'dateOfBirth',
    'stateIssued',
    'sex',
  ],

  PASSPORT: [
    'name',
    'firstName',
    'lastName',
    'passportNumber',
    'expirationDate',
    'issueDate',
    'dateOfBirth',
    'countryIssued',
    'sex',
  ],

  BIRTH_CERTIFICATE: [
    'name',
    'firstName',
    'lastName',
    'dateOfBirth',
    'stateIssued',
  ],

  // Business documents
  BUSINESS_LICENSE: [
    'businessName',
    'dba',
    'ein',
    'businessType',
    'businessAddress',
  ],

  EIN_LETTER: [
    'businessName',
    'ein',
    'businessAddress',
  ],

  PROFIT_LOSS_STATEMENT: [
    'businessName',
    'grossReceipts',
    'expenses',
    'netProfit',
  ],

  BANK_STATEMENT: [
    'accountHolder',
    'accountNumber',
    'bankName',
    'statementDate',
    'endingBalance',
  ],

  // Expense documents
  DAYCARE_RECEIPT: [
    'providerName',
    'providerTin',
    'childName',
    'amountPaid',
  ],

  RECEIPT: [
    'vendor',
    'amount',
    'date',
    'description',
    'category',
  ],

  // Fallback/generic
  OTHER: [
    'name',
    'amount',
    'date',
    'description',
  ],

  UNKNOWN: [
    'name',
    'amount',
    'date',
    'description',
  ],
}

/**
 * Get fields for a document type with fallback to OTHER
 */
export function getDocTypeFields(docType: string): string[] {
  return DOC_TYPE_FIELDS[docType] || DOC_TYPE_FIELDS.OTHER || []
}

/**
 * Check if a field is valid for a given document type
 */
export function isValidFieldForDocType(docType: string, fieldKey: string): boolean {
  const fields = getDocTypeFields(docType)
  return fields.includes(fieldKey)
}
