/**
 * Schedule K-1 (Form 1041) OCR Extraction Prompt
 * Trust/Estate K-1 - Beneficiary's Share of Income, Deductions, Credits
 */

export interface ScheduleK1_1041ExtractedData {
  estateTrustName: string | null
  estateTrustEIN: string | null
  fiduciaryName: string | null
  fiduciaryAddress: string | null
  beneficiaryName: string | null
  beneficiarySSN: string | null
  beneficiaryAddress: string | null
  interestIncome: number | null             // Box 1
  ordinaryDividends: number | null          // Box 2a
  qualifiedDividends: number | null         // Box 2b
  netShortTermCapitalGain: number | null    // Box 3
  netLongTermCapitalGain: number | null     // Box 4a
  unrecapturedSection1250: number | null    // Box 4b
  otherPortfolioIncome: number | null       // Box 5
  ordinaryBusinessIncome: number | null     // Box 6
  netRentalRealEstateIncome: number | null  // Box 7
  otherRentalIncome: number | null          // Box 8
  directlyApportionedDeductions: string | null // Box 9
  estateTaxDeduction: number | null         // Box 10
  finalYearDeductions: string | null        // Box 11
  alternativeMinimumTax: string | null      // Box 12
  credits: string | null                    // Box 13
  otherInformation: string | null           // Box 14
  distributionAmount: number | null
  requiredDistribution: boolean
  taxYear: number | null
  finalK1: boolean
  amendedK1: boolean
}

export function getK1_1041ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Schedule K-1 (Form 1041) - Beneficiary's Share of Income from a Trust or Estate.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null.

Extract the following fields:

PART I - ESTATE/TRUST INFO:
- estateTrustName: Name of estate or trust
- estateTrustEIN: EIN (XX-XXXXXXX)
- fiduciaryName: Fiduciary's name
- fiduciaryAddress: Fiduciary's address

PART II - BENEFICIARY INFO:
- beneficiaryName, beneficiarySSN (XXX-XX-XXXX), beneficiaryAddress

PART III - BENEFICIARY'S SHARE:
- interestIncome: Box 1
- ordinaryDividends: Box 2a, qualifiedDividends: Box 2b
- netShortTermCapitalGain: Box 3
- netLongTermCapitalGain: Box 4a, unrecapturedSection1250: Box 4b
- otherPortfolioIncome: Box 5
- ordinaryBusinessIncome: Box 6
- netRentalRealEstateIncome: Box 7
- otherRentalIncome: Box 8
- directlyApportionedDeductions: Box 9 (include codes)
- estateTaxDeduction: Box 10
- finalYearDeductions: Box 11 (include codes)
- alternativeMinimumTax: Box 12 (include codes)
- credits: Box 13 (include codes)
- otherInformation: Box 14 (include codes)

DISTRIBUTION INFO:
- distributionAmount: Total distribution to beneficiary
- requiredDistribution: true if required distribution

METADATA:
- taxYear, finalK1 (boolean), amendedK1 (boolean)

Respond in JSON format:
{
  "estateTrustName": "Smith Family Trust",
  "estateTrustEIN": "XX-XXXXXXX",
  "fiduciaryName": "Jane Smith, Trustee",
  "fiduciaryAddress": "100 Trust Way, City, ST 12345",
  "beneficiaryName": "John Smith",
  "beneficiarySSN": "XXX-XX-XXXX",
  "beneficiaryAddress": "456 Main St, City, ST 67890",
  "interestIncome": 5000.00,
  "ordinaryDividends": 3000.00,
  "qualifiedDividends": 2500.00,
  "netShortTermCapitalGain": null,
  "netLongTermCapitalGain": 10000.00,
  "unrecapturedSection1250": null,
  "otherPortfolioIncome": null,
  "ordinaryBusinessIncome": null,
  "netRentalRealEstateIncome": 8000.00,
  "otherRentalIncome": null,
  "directlyApportionedDeductions": null,
  "estateTaxDeduction": null,
  "finalYearDeductions": null,
  "alternativeMinimumTax": null,
  "credits": null,
  "otherInformation": null,
  "distributionAmount": 26000.00,
  "requiredDistribution": true,
  "taxYear": 2024,
  "finalK1": false,
  "amendedK1": false
}

Rules:
1. All monetary values as numbers without $ or commas
2. Use null for empty/unclear fields, NEVER guess
3. Boxes 1-8 are income types most important for tax prep
4. For coded boxes (9, 11-14), include code letter with amount
5. Negative values indicate losses`
}

export function validateK1_1041Data(data: unknown): data is ScheduleK1_1041ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['estateTrustName', 'estateTrustEIN', 'beneficiaryName', 'beneficiarySSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.finalK1 !== 'boolean') return false
  if (typeof d.amendedK1 !== 'boolean') return false
  if (typeof d.requiredDistribution !== 'boolean') return false
  return true
}

export const SCHEDULE_K1_1041_FIELD_LABELS_VI: Record<string, string> = {
  estateTrustName: 'Tên Quỹ tín thác/Di sản',
  estateTrustEIN: 'EIN Quỹ tín thác',
  fiduciaryName: 'Tên Người được ủy thác',
  fiduciaryAddress: 'Địa chỉ Người được ủy thác',
  beneficiaryName: 'Tên Người thụ hưởng',
  beneficiarySSN: 'SSN Người thụ hưởng',
  beneficiaryAddress: 'Địa chỉ Người thụ hưởng',
  interestIncome: 'Thu nhập lãi (Box 1)',
  ordinaryDividends: 'Cổ tức thông thường (Box 2a)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Box 2b)',
  netShortTermCapitalGain: 'Lãi vốn ngắn hạn (Box 3)',
  netLongTermCapitalGain: 'Lãi vốn dài hạn (Box 4a)',
  unrecapturedSection1250: 'Lãi Section 1250 (Box 4b)',
  otherPortfolioIncome: 'Thu nhập danh mục khác (Box 5)',
  ordinaryBusinessIncome: 'Thu nhập kinh doanh (Box 6)',
  netRentalRealEstateIncome: 'Thu nhập cho thuê BĐS (Box 7)',
  otherRentalIncome: 'Thu nhập cho thuê khác (Box 8)',
  directlyApportionedDeductions: 'Khấu trừ trực tiếp (Box 9)',
  estateTaxDeduction: 'Khấu trừ thuế di sản (Box 10)',
  finalYearDeductions: 'Khấu trừ năm cuối (Box 11)',
  alternativeMinimumTax: 'Thuế tối thiểu thay thế (Box 12)',
  credits: 'Tín dụng thuế (Box 13)',
  otherInformation: 'Thông tin khác (Box 14)',
  distributionAmount: 'Số tiền phân phối',
  requiredDistribution: 'Phân phối bắt buộc',
  taxYear: 'Năm thuế',
  finalK1: 'K-1 cuối cùng',
  amendedK1: 'K-1 sửa đổi',
}
