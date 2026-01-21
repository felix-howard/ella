/**
 * SSA-1099 OCR Extraction Prompt
 * Extracts structured data from Form SSA-1099 (Social Security Benefit Statement)
 */

/**
 * SSA-1099 extracted data structure
 * Matches Form SSA-1099 box layout
 */
export interface FormSsa1099ExtractedData {
  // Beneficiary Information
  beneficiaryName: string | null
  beneficiaryAddress: string | null
  beneficiarySSN: string | null

  // Benefit Information (Boxes 3-6)
  totalBenefitsPaid: number | null // Box 3 - Benefits paid in year
  benefitsRepaid: number | null // Box 4 - Benefits repaid to SSA
  netBenefits: number | null // Box 5 - Net benefits (Box 3 - Box 4)
  voluntaryTaxWithheld: number | null // Box 6 - Voluntary federal income tax withheld

  // Additional Information
  claimNumber: string | null // Claim number (may differ from SSN)
  descriptionOfBenefits: string | null // Description of amount in Box 3

  // Medicare Premium Information (if shown)
  medicarePremiums: number | null

  // Metadata
  taxYear: number | null
  formType: 'SSA-1099' | 'RRB-1099' | null // Social Security vs Railroad
}

/**
 * Generate SSA-1099 OCR extraction prompt
 */
export function getSsa1099ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Form SSA-1099 (Social Security Benefit Statement).

IMPORTANT: This reports Social Security benefits received during the year.

Extract the following fields:

BENEFICIARY INFORMATION:
- beneficiaryName: Name of Social Security recipient
- beneficiaryAddress: Complete address
- beneficiarySSN: Social Security number (XXX-XX-XXXX)
- claimNumber: Claim number (may include suffix letter)

BENEFIT INFORMATION:
- totalBenefitsPaid: Box 3 - Total benefits paid (MOST IMPORTANT)
- benefitsRepaid: Box 4 - Benefits repaid to SSA in year
- netBenefits: Box 5 - Net benefits (Box 3 minus Box 4)
- voluntaryTaxWithheld: Box 6 - Voluntary federal income tax withheld

ADDITIONAL:
- descriptionOfBenefits: Description text if present
- medicarePremiums: Medicare Part B/D premiums deducted (if shown)

METADATA:
- taxYear: The year this statement covers
- formType: "SSA-1099" for Social Security, "RRB-1099" for Railroad Retirement

Respond in JSON format:
{
  "beneficiaryName": "JOHN DOE",
  "beneficiaryAddress": "123 Main St, City, ST 12345",
  "beneficiarySSN": "XXX-XX-XXXX",
  "claimNumber": "XXX-XX-XXXX-A",
  "totalBenefitsPaid": 18000.00,
  "benefitsRepaid": 0,
  "netBenefits": 18000.00,
  "voluntaryTaxWithheld": 1800.00,
  "descriptionOfBenefits": "RETIREMENT BENEFITS",
  "medicarePremiums": 1980.00,
  "taxYear": 2024,
  "formType": "SSA-1099"
}

Rules:
1. Box 5 (netBenefits) is used for tax calculations
2. Only portion of SS benefits may be taxable (up to 85%)
3. Claim number may have letter suffix (A, B, C, etc.)
4. Use null for empty or unclear fields, NEVER guess`
}

/**
 * Validate SSA-1099 extracted data
 */
export function validateSsa1099Data(data: unknown): data is FormSsa1099ExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['beneficiaryName', 'beneficiarySSN', 'netBenefits']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate formType if present
  if (d.formType !== null && d.formType !== 'SSA-1099' && d.formType !== 'RRB-1099') {
    return false
  }

  // Validate key numeric field (allow null or number)
  if (d.netBenefits !== null && typeof d.netBenefits !== 'number') return false

  return true
}

/**
 * Vietnamese field labels for SSA-1099
 */
export const FORM_SSA_1099_FIELD_LABELS_VI: Record<string, string> = {
  beneficiaryName: 'Tên Người nhận',
  beneficiaryAddress: 'Địa chỉ Người nhận',
  beneficiarySSN: 'SSN Người nhận',
  claimNumber: 'Số yêu cầu',
  totalBenefitsPaid: 'Tổng trợ cấp đã trả (Box 3)',
  benefitsRepaid: 'Trợ cấp đã hoàn trả (Box 4)',
  netBenefits: 'Trợ cấp ròng (Box 5)',
  voluntaryTaxWithheld: 'Thuế tự nguyện đã khấu trừ (Box 6)',
  descriptionOfBenefits: 'Mô tả trợ cấp',
  medicarePremiums: 'Phí bảo hiểm Medicare',
  taxYear: 'Năm thuế',
  formType: 'Loại biểu mẫu',
}
