/**
 * Schedule K-1 (Form 1120-S) OCR Extraction Prompt
 * S-Corporation K-1 - Shareholder's Share of Income, Deductions, Credits
 */

export interface ScheduleK1_1120SExtractedData {
  corporationName: string | null
  corporationEIN: string | null
  corporationAddress: string | null
  shareholderName: string | null
  shareholderSSN: string | null
  shareholderAddress: string | null
  stockOwnershipBeginning: number | null
  stockOwnershipEnding: number | null
  ordinaryBusinessIncome: number | null     // Box 1
  netRentalRealEstateIncome: number | null  // Box 2
  otherNetRentalIncome: number | null       // Box 3
  interestIncome: number | null             // Box 4
  ordinaryDividends: number | null          // Box 5a
  qualifiedDividends: number | null         // Box 5b
  royalties: number | null                  // Box 6
  netShortTermCapitalGain: number | null    // Box 7
  netLongTermCapitalGain: number | null     // Box 8a
  collectiblesGain: number | null           // Box 8b
  unrecapturedSection1250: number | null    // Box 8c
  netSection1231Gain: number | null         // Box 9
  otherIncome: string | null                // Box 10
  section179Deduction: number | null        // Box 11
  charitableContributions: string | null    // Box 12a
  otherDeductions: string | null            // Box 12d
  lowIncomeHousingCredit: number | null     // Box 13a
  foreignTaxCredit: number | null           // Box 13b
  otherCredits: string | null               // Box 13g
  basisAtBeginning: number | null
  basisAdjustments: number | null
  basisAtEnding: number | null
  taxYear: number | null
  finalK1: boolean
  amendedK1: boolean
}

export function getK1_1120SExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Schedule K-1 (Form 1120-S) - Shareholder's Share of Income from an S-Corporation.

IMPORTANT: S-Corp K-1 differs from Partnership K-1. S-Corp shareholders do NOT have self-employment earnings. Accuracy is critical.

Extract the following fields:

PART I - S-CORPORATION INFO:
- corporationName, corporationEIN (XX-XXXXXXX), corporationAddress

PART II - SHAREHOLDER INFO:
- shareholderName, shareholderSSN (XXX-XX-XXXX), shareholderAddress
- stockOwnershipBeginning/Ending: Stock ownership percentages

PART III - INCOME/DEDUCTIONS:
- ordinaryBusinessIncome: Box 1 (MOST IMPORTANT)
- netRentalRealEstateIncome: Box 2
- otherNetRentalIncome: Box 3
- interestIncome: Box 4
- ordinaryDividends: Box 5a, qualifiedDividends: Box 5b
- royalties: Box 6
- netShortTermCapitalGain: Box 7
- netLongTermCapitalGain: Box 8a, collectiblesGain: Box 8b, unrecapturedSection1250: Box 8c
- netSection1231Gain: Box 9
- otherIncome: Box 10 (include code letters)
- section179Deduction: Box 11
- charitableContributions: Box 12a (include code)
- otherDeductions: Box 12d (include codes)
- lowIncomeHousingCredit: Box 13a
- foreignTaxCredit: Box 13b
- otherCredits: Box 13g (include codes)

STOCK BASIS (if present):
- basisAtBeginning, basisAdjustments, basisAtEnding

METADATA:
- taxYear, finalK1 (boolean), amendedK1 (boolean)

Respond in JSON format:
{
  "corporationName": "XYZ Corp Inc",
  "corporationEIN": "XX-XXXXXXX",
  "corporationAddress": "100 Corp Dr, City, ST 12345",
  "shareholderName": "John Doe",
  "shareholderSSN": "XXX-XX-XXXX",
  "shareholderAddress": "456 Main St, City, ST 67890",
  "stockOwnershipBeginning": 33.33,
  "stockOwnershipEnding": 33.33,
  "ordinaryBusinessIncome": 75000.00,
  "netRentalRealEstateIncome": null,
  "otherNetRentalIncome": null,
  "interestIncome": null,
  "ordinaryDividends": 2000.00,
  "qualifiedDividends": 2000.00,
  "royalties": null,
  "netShortTermCapitalGain": null,
  "netLongTermCapitalGain": 3000.00,
  "collectiblesGain": null,
  "unrecapturedSection1250": null,
  "netSection1231Gain": null,
  "otherIncome": null,
  "section179Deduction": null,
  "charitableContributions": "A - 5000",
  "otherDeductions": null,
  "lowIncomeHousingCredit": null,
  "foreignTaxCredit": null,
  "otherCredits": null,
  "basisAtBeginning": 50000.00,
  "basisAdjustments": 75000.00,
  "basisAtEnding": 125000.00,
  "taxYear": 2024,
  "finalK1": false,
  "amendedK1": false
}

Rules:
1. All monetary values as numbers without $ or commas
2. Percentages as decimal (25% = 25.00)
3. Use null for empty/unclear fields, NEVER guess
4. Box 1 is most important - S-Corp does NOT have self-employment earnings
5. For coded boxes (10, 12, 13), include code letter with amount
6. Negative values indicate losses`
}

export function validateK1_1120SData(data: unknown): data is ScheduleK1_1120SExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['corporationName', 'corporationEIN', 'shareholderName', 'shareholderSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.finalK1 !== 'boolean') return false
  if (typeof d.amendedK1 !== 'boolean') return false
  if (d.ordinaryBusinessIncome !== null && d.ordinaryBusinessIncome !== undefined && typeof d.ordinaryBusinessIncome !== 'number') return false
  return true
}

export const SCHEDULE_K1_1120S_FIELD_LABELS_VI: Record<string, string> = {
  corporationName: 'Tên Công ty S-Corp',
  corporationEIN: 'EIN Công ty',
  corporationAddress: 'Địa chỉ Công ty',
  shareholderName: 'Tên Cổ đông',
  shareholderSSN: 'SSN/EIN Cổ đông',
  shareholderAddress: 'Địa chỉ Cổ đông',
  stockOwnershipBeginning: 'Tỷ lệ sở hữu đầu kỳ (%)',
  stockOwnershipEnding: 'Tỷ lệ sở hữu cuối kỳ (%)',
  ordinaryBusinessIncome: 'Thu nhập kinh doanh (Box 1)',
  netRentalRealEstateIncome: 'Thu nhập cho thuê BĐS (Box 2)',
  otherNetRentalIncome: 'Thu nhập cho thuê khác (Box 3)',
  interestIncome: 'Thu nhập lãi (Box 4)',
  ordinaryDividends: 'Cổ tức thông thường (Box 5a)',
  qualifiedDividends: 'Cổ tức đủ điều kiện (Box 5b)',
  royalties: 'Tiền bản quyền (Box 6)',
  netShortTermCapitalGain: 'Lãi vốn ngắn hạn (Box 7)',
  netLongTermCapitalGain: 'Lãi vốn dài hạn (Box 8a)',
  collectiblesGain: 'Lãi sưu tầm (Box 8b)',
  unrecapturedSection1250: 'Lãi Section 1250 (Box 8c)',
  netSection1231Gain: 'Lãi Section 1231 (Box 9)',
  otherIncome: 'Thu nhập khác (Box 10)',
  section179Deduction: 'Khấu hao Section 179 (Box 11)',
  charitableContributions: 'Đóng góp từ thiện (Box 12a)',
  otherDeductions: 'Khấu trừ khác (Box 12d)',
  lowIncomeHousingCredit: 'Tín dụng nhà ở thu nhập thấp (Box 13a)',
  foreignTaxCredit: 'Tín dụng thuế nước ngoài (Box 13b)',
  otherCredits: 'Tín dụng khác (Box 13g)',
  basisAtBeginning: 'Cơ sở vốn đầu kỳ',
  basisAdjustments: 'Điều chỉnh cơ sở vốn',
  basisAtEnding: 'Cơ sở vốn cuối kỳ',
  taxYear: 'Năm thuế',
  finalK1: 'K-1 cuối cùng',
  amendedK1: 'K-1 sửa đổi',
}
