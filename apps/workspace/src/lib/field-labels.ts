/**
 * Field labels for document verification workflow
 * Maps extracted data field keys to Vietnamese display labels
 * Used in VerificationModal and DataEntryModal
 */

// W2 form fields
const W2_FIELDS: Record<string, string> = {
  employerName: 'Tên công ty',
  employerEIN: 'EIN công ty',
  employerAddress: 'Địa chỉ công ty',
  wages: 'Lương Box 1',
  federalWithholding: 'Thuế liên bang Box 2',
  socialSecurityWages: 'Social Security Box 3',
  socialSecurityTax: 'Thuế SS Box 4',
  medicareWages: 'Medicare Box 5',
  medicareTax: 'Thuế Medicare Box 6',
  employeeSsn: 'SSN nhân viên',
  employeeName: 'Tên nhân viên',
  employeeAddress: 'Địa chỉ nhân viên',
  stateTax: 'Thuế tiểu bang',
  localTax: 'Thuế địa phương',
}

// 1099-INT form fields
const FORM_1099_INT_FIELDS: Record<string, string> = {
  payerName: 'Tên ngân hàng',
  payerTin: 'TIN ngân hàng',
  interestIncome: 'Thu nhập lãi',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-DIV form fields
const FORM_1099_DIV_FIELDS: Record<string, string> = {
  payerName: 'Tên người trả',
  payerTin: 'TIN người trả',
  ordinaryDividends: 'Cổ tức thường',
  qualifiedDividends: 'Cổ tức đủ điều kiện',
  capitalGain: 'Lợi nhuận vốn',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-NEC form fields
const FORM_1099_NEC_FIELDS: Record<string, string> = {
  // Payer info
  payerName: 'Người trả tiền',
  payerAddress: 'Địa chỉ người trả',
  payerTIN: 'TIN người trả',
  payerPhone: 'SĐT người trả',
  // Recipient info
  recipientName: 'Người nhận',
  recipientAddress: 'Địa chỉ người nhận',
  recipientTIN: 'SSN người nhận',
  accountNumber: 'Số tài khoản',
  // Boxes
  nonemployeeCompensation: 'Box 1 - Thu nhập',
  payerMadeDirectSales: 'Box 2 - Bán hàng >$5K',
  federalIncomeTaxWithheld: 'Box 4 - Thuế LB khấu trừ',
  // State info (flattened)
  state: 'Box 5 - Tiểu bang',
  statePayerStateNo: 'Box 6 - ID tiểu bang',
  stateIncome: 'Box 7 - Thu nhập TB',
  // Metadata
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}

// 1099-MISC form fields
const FORM_1099_MISC_FIELDS: Record<string, string> = {
  payerName: 'Tên người trả',
  payerTin: 'TIN người trả',
  rents: 'Tiền thuê',
  royalties: 'Tiền bản quyền',
  otherIncome: 'Thu nhập khác',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-K form fields
const FORM_1099_K_FIELDS: Record<string, string> = {
  filerName: 'Tên PSE',
  filerTin: 'TIN PSE',
  grossAmount: 'Tổng thu nhập',
  cardTransactions: 'Giao dịch thẻ',
  paymentNetwork: 'Mạng thanh toán',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-R form fields (retirement distributions)
const FORM_1099_R_FIELDS: Record<string, string> = {
  payerName: 'Tên quỹ hưu',
  payerTin: 'TIN quỹ hưu',
  grossDistribution: 'Tổng phân phối',
  taxableAmount: 'Số tiền chịu thuế',
  federalWithholding: 'Thuế liên bang',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-G form fields (government payments)
const FORM_1099_G_FIELDS: Record<string, string> = {
  payerName: 'Cơ quan chính phủ',
  unemploymentCompensation: 'Trợ cấp thất nghiệp',
  stateLocalRefund: 'Hoàn thuế tiểu bang',
  federalWithholding: 'Thuế liên bang',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// 1099-SSA form fields (social security)
const FORM_1099_SSA_FIELDS: Record<string, string> = {
  benefitsReceived: 'Quyền lợi nhận được',
  benefitsRepaid: 'Quyền lợi hoàn trả',
  netBenefits: 'Quyền lợi ròng',
  federalWithholding: 'Thuế liên bang',
  recipientSsn: 'SSN người nhận',
  recipientName: 'Tên người nhận',
}

// Identity document fields (SSN card, driver license, passport)
const IDENTITY_FIELDS: Record<string, string> = {
  name: 'Họ tên',
  firstName: 'Tên',
  lastName: 'Họ',
  middleName: 'Tên đệm',
  ssn: 'Số SSN',
  address: 'Địa chỉ',
  licenseNumber: 'Số bằng lái',
  passportNumber: 'Số hộ chiếu',
  expirationDate: 'Ngày hết hạn',
  issueDate: 'Ngày cấp',
  dateOfBirth: 'Ngày sinh',
  stateIssued: 'Tiểu bang cấp',
  countryIssued: 'Quốc gia cấp',
  sex: 'Giới tính',
}

// Business document fields
const BUSINESS_FIELDS: Record<string, string> = {
  businessName: 'Tên doanh nghiệp',
  ein: 'Số EIN',
  dba: 'Tên DBA',
  businessType: 'Loại hình',
  businessAddress: 'Địa chỉ doanh nghiệp',
}

// 1098 form fields (mortgage interest)
const FORM_1098_FIELDS: Record<string, string> = {
  lenderName: 'Tên ngân hàng cho vay',
  mortgageInterest: 'Lãi vay nhà',
  realEstateTax: 'Thuế bất động sản',
  mortgageInsurance: 'Bảo hiểm thế chấp',
  recipientSsn: 'SSN người vay',
  recipientName: 'Tên người vay',
  propertyAddress: 'Địa chỉ bất động sản',
}

// 1098-T form fields (tuition)
const FORM_1098_T_FIELDS: Record<string, string> = {
  schoolName: 'Tên trường',
  schoolEin: 'EIN trường',
  tuitionPaid: 'Học phí đã trả',
  scholarships: 'Học bổng',
  adjustments: 'Điều chỉnh',
  studentSsn: 'SSN sinh viên',
  studentName: 'Tên sinh viên',
}

// Generic/fallback fields
const GENERIC_FIELDS: Record<string, string> = {
  amount: 'Số tiền',
  date: 'Ngày',
  description: 'Mô tả',
  notes: 'Ghi chú',
  total: 'Tổng cộng',
  vendor: 'Nhà cung cấp',
  category: 'Danh mục',
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
 * Get label for a field key
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
 * Filter out metadata fields that shouldn't be shown in verification UI
 */
export const EXCLUDED_FIELDS = ['aiConfidence', 'rawText', 'confidence', 'documentType']

/**
 * Check if a field should be excluded from verification
 */
export function isExcludedField(fieldKey: string): boolean {
  return EXCLUDED_FIELDS.includes(fieldKey)
}
