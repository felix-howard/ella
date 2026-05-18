/**
 * Validation Utilities
 * Input sanitization and file validation helpers
 */
import { config } from './config'

/**
 * Sanitize search input to prevent injection attacks
 * Removes special characters that could be used for SQL/NoSQL injection
 */
export function sanitizeSearchInput(input: string): string {
  if (!input) return ''

  // Remove or escape potentially dangerous characters
  // Keep alphanumeric, spaces, basic punctuation for names/emails/phones
  return input
    .trim()
    .slice(0, 100) // Limit length
    .replace(/[<>{}[\]\\^`|]/g, '') // Remove dangerous chars
    .replace(/['";]/g, '') // Remove SQL injection chars
    .replace(/\$/g, '') // Remove NoSQL injection char
}

/**
 * File upload validation result
 */
export interface FileValidationResult {
  valid: boolean
  error?: string
  errorCode?:
    | 'INVALID_TYPE'
    | 'INVALID_FILE_CONTENT'
    | 'FILE_TOO_LARGE'
    | 'TOO_MANY_FILES'
    | 'NO_FILES'
}

export type DetectedFileType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif'

interface UploadedFileWithBuffer {
  file: File
  buffer: Buffer
}

const ALLOWED_HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'])
const MAX_PDF_HEADER_PREFIX_BYTES = 16

function startsWithBytes(buffer: Buffer, bytes: number[], offset = 0): boolean {
  if (buffer.length < offset + bytes.length) return false
  return bytes.every((byte, index) => buffer[offset + index] === byte)
}

function findPdfHeaderOffset(buffer: Buffer): number {
  let offset = 0

  if (startsWithBytes(buffer, [0xef, 0xbb, 0xbf])) {
    offset = 3
  }

  while (offset < buffer.length && [0x09, 0x0a, 0x0c, 0x0d, 0x20].includes(buffer[offset])) {
    offset++
  }

  return offset <= MAX_PDF_HEADER_PREFIX_BYTES ? offset : -1
}

function detectHeifType(buffer: Buffer): DetectedFileType | null {
  if (buffer.length < 12 || buffer.toString('ascii', 4, 8) !== 'ftyp') return null

  const majorBrand = buffer.toString('ascii', 8, 12)
  const compatibleBrands: string[] = []
  for (let offset = 16; offset + 4 <= Math.min(buffer.length, 64); offset += 4) {
    compatibleBrands.push(buffer.toString('ascii', offset, offset + 4))
  }

  const brands = [majorBrand, ...compatibleBrands]
  const heifBrand = brands.find((brand) => ALLOWED_HEIF_BRANDS.has(brand))
  if (!heifBrand) return null

  return ['heic', 'heix', 'hevc', 'hevx'].includes(heifBrand) ? 'image/heic' : 'image/heif'
}

/**
 * Detect supported upload content using file signatures.
 */
export function detectFileType(buffer: Buffer): DetectedFileType | null {
  const pdfOffset = findPdfHeaderOffset(buffer)
  if (pdfOffset >= 0 && buffer.toString('ascii', pdfOffset, pdfOffset + 5) === '%PDF-') {
    return 'application/pdf'
  }

  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return 'image/jpeg'
  }

  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png'
  }

  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }

  return detectHeifType(buffer)
}

function mimeTypesMatch(declaredMimeType: string, detectedMimeType: DetectedFileType): boolean {
  if (declaredMimeType === detectedMimeType) return true

  const heifFamily = new Set(['image/heic', 'image/heif'])
  return heifFamily.has(declaredMimeType) && heifFamily.has(detectedMimeType)
}

/**
 * Validate uploaded files for type and size
 */
export function validateUploadedFiles(files: File[]): FileValidationResult {
  if (!files || files.length === 0) {
    return {
      valid: false,
      error: 'No files provided',
      errorCode: 'NO_FILES',
    }
  }

  if (files.length > config.upload.maxFilesPerUpload) {
    return {
      valid: false,
      error: `Maximum ${config.upload.maxFilesPerUpload} files allowed per upload`,
      errorCode: 'TOO_MANY_FILES',
    }
  }

  for (const file of files) {
    // Check file size
    if (file.size > config.upload.maxFileSize) {
      const maxMB = Math.round(config.upload.maxFileSize / 1024 / 1024)
      return {
        valid: false,
        error: `File "${file.name}" exceeds maximum size of ${maxMB}MB`,
        errorCode: 'FILE_TOO_LARGE',
      }
    }

    // Check mime type
    const mimeType = file.type || 'application/octet-stream'
    if (!(config.upload.allowedMimeTypes as readonly string[]).includes(mimeType)) {
      return {
        valid: false,
        error: `File type "${mimeType}" is not allowed. Allowed: images (JPEG, PNG, WebP, HEIC) and PDF`,
        errorCode: 'INVALID_TYPE',
      }
    }
  }

  return { valid: true }
}

/**
 * Validate uploaded file buffers against supported content signatures.
 */
export function validateUploadedFileContent(
  filesWithBuffers: UploadedFileWithBuffer[]
): FileValidationResult {
  for (const { file, buffer } of filesWithBuffers) {
    const declaredMimeType = file.type || 'application/octet-stream'
    const detectedMimeType = detectFileType(buffer)

    if (!detectedMimeType || !mimeTypesMatch(declaredMimeType, detectedMimeType)) {
      return {
        valid: false,
        error: 'File content does not match an allowed document or image type',
        errorCode: 'INVALID_FILE_CONTENT',
      }
    }
  }

  return { valid: true }
}

/**
 * Pick only allowed fields from an object (prevents mass assignment)
 */
export function pickFields<T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  allowedFields: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const field of allowedFields) {
    if (field in obj) {
      result[field] = obj[field]
    }
  }
  return result
}

/**
 * Whitelist of valid fields per document type for verification
 * Prevents arbitrary field injection into JSON columns
 */
export const VALID_DOC_FIELDS: Record<string, string[]> = {
  W2: [
    'employerName', 'employerEIN', 'employerAddress',
    'employeeName', 'employeeSSN', 'employeeAddress',
    'wages', 'federalWithholding', 'socialSecurityWages',
    'socialSecurityTax', 'medicareWages', 'medicareTax',
    'socialSecurityTips', 'allocatedTips', 'dependentCareBenefits',
    'nonqualifiedPlans', 'box12a', 'box12b', 'box12c', 'box12d',
    'statutory', 'retirementPlan', 'thirdPartySickPay',
    'state', 'stateId', 'stateWages', 'stateTax',
    'localWages', 'localTax', 'localityName',
  ],
  FORM_1099_INT: [
    'payerName', 'payerTIN', 'payerAddress',
    'recipientName', 'recipientTIN', 'recipientAddress',
    'interestIncome', 'earlyWithdrawalPenalty', 'usSavingsBonds',
    'federalTaxWithheld', 'investmentExpenses', 'foreignTaxPaid',
    'foreignCountry', 'taxExemptInterest', 'privateBondInterest',
    'marketDiscount', 'bondPremium', 'bondPremiumTreasury',
    'bondPremiumTaxExempt', 'cusipNumber', 'state', 'stateId', 'stateTaxWithheld',
  ],
  FORM_1099_NEC: [
    'payerName', 'payerTIN', 'payerAddress', 'payerPhone',
    'recipientName', 'recipientTIN', 'recipientAddress', 'accountNumber',
    'nonemployeeCompensation', 'payerMadeDirectSales',
    'federalIncomeTaxWithheld', 'federalTaxWithheld', // Both names for compatibility
    'state', 'stateId', 'statePayerStateNo', 'stateIncome', 'stateTaxWithheld',
    'taxYear', 'corrected',
  ],
  SSN_CARD: ['name', 'ssn', 'cardType'],
  DRIVER_LICENSE: [
    'fullName', 'firstName', 'lastName', 'middleName',
    'dateOfBirth', 'address', 'city', 'state', 'zipCode',
    'licenseNumber', 'expirationDate', 'issueDate',
    'sex', 'height', 'eyeColor', 'documentDiscriminator',
  ],
  SCHEDULE_C: [
    'taxYear',
    // Business Information
    'businessName', 'proprietorName', 'principalBusinessCode',
    'businessAddress', 'ein', 'accountingMethod',
    // Income (Part I)
    'grossReceipts', 'returns', 'grossReceiptsLessReturns',
    'costOfGoodsSold', 'grossProfit', 'otherIncome', 'grossIncome',
    // Expenses (Part II)
    'advertising', 'carAndTruck', 'commissions', 'contractLabor',
    'depletion', 'depreciation', 'employeeBenefit', 'insurance',
    'interestMortgage', 'interestOther', 'legalAndProfessional',
    'officeExpense', 'pensionProfitSharing', 'rentVehicles', 'rentMachinery',
    'repairs', 'supplies', 'taxesLicenses', 'travel', 'mealsDeductible',
    'utilities', 'wages', 'otherExpensesDescription', 'otherExpensesAmount',
    'totalExpenses',
    // Net Profit/Loss
    'tentativeProfit', 'expensesForHomeUse', 'netProfit',
    // Additional Info
    'materialParticipation', 'startedOrAcquiredInYear',
  ],
  FORM_1099_DIV: [
    'payerName', 'payerTIN', 'payerAddress',
    'recipientName', 'recipientTIN', 'recipientAddress',
    'ordinaryDividends', 'qualifiedDividends', 'capitalGainDistributions',
    'unrecaptured1250Gain', 'section1202Gain', 'collectiblesGain',
    'nondividendDistributions', 'federalTaxWithheld', 'investmentExpenses',
    'foreignTaxPaid', 'foreignCountry', 'cashLiquidation', 'noncashLiquidation',
    'exemptInterestDividends', 'privateBondDividends',
    'state', 'stateId', 'stateTaxWithheld', 'taxYear',
  ],
  FORM_1040: [
    'taxYear', 'formVariant',
    'taxpayerName', 'taxpayerSSN', 'filingStatus',
    'spouseName', 'spouseSSN',
    'totalWages', 'totalIncome', 'adjustedGrossIncome',
    'taxableIncome', 'standardOrItemizedDeduction', 'totalTax',
    'childTaxCredit', 'earnedIncomeCredit', 'adjustmentsToIncome',
    'totalWithheld', 'totalPayments', 'refundAmount', 'amountOwed',
    'attachedSchedules', 'digitalAssetsAnswer',
  ],
  BANK_STATEMENT: [
    'bankName', 'routingNumber', 'accountNumber', 'accountType',
    'statementPeriodStart', 'statementPeriodEnd',
    'beginningBalance', 'endingBalance', 'depositsTotal', 'withdrawalsTotal',
  ],
  // Generic fields for other doc types
  OTHER: ['rawText', 'notes'],
  UNKNOWN: ['rawText', 'notes'],
}

/**
 * Validate that a field name is allowed for a document type
 * Prevents JSON injection via arbitrary field names
 */
export function isValidDocField(docType: string | null, fieldName: string): boolean {
  if (!docType) return false

  const validFields = VALID_DOC_FIELDS[docType]
  if (!validFields) {
    // For unsupported doc types, only allow generic fields
    return VALID_DOC_FIELDS.OTHER.includes(fieldName)
  }

  return validFields.includes(fieldName)
}

/**
 * Sanitize text input for XSS prevention
 * Removes HTML tags and control characters, limits length
 */
export function sanitizeTextInput(input: string, maxLength = 500): string {
  if (!input) return ''

  return input
    .trim()
    .slice(0, maxLength)
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>]/g, '') // Remove remaining angle brackets
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, '') // Remove control characters
}

/**
 * Sanitize reupload reason for database storage
 */
export function sanitizeReuploadReason(reason: string): string {
  return sanitizeTextInput(reason, 500)
}
