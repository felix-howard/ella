/**
 * 5498-SA OCR Extraction Prompt
 * HSA, Archer MSA, or Medicare Advantage MSA Information
 */

export interface Form5498SAExtractedData {
  trusteeName: string | null
  trusteeAddress: string | null
  trusteeTIN: string | null
  trusteePhone: string | null
  participantName: string | null
  participantSSN: string | null
  participantAddress: string | null
  accountNumber: string | null
  employerContributions: number | null      // Box 1
  totalContributions: number | null         // Box 2
  totalHSAContributions: number | null      // Box 3
  rolloverContributions: number | null      // Box 4
  fairMarketValue: number | null            // Box 5
  accountType: 'HSA' | 'ARCHER_MSA' | 'MA_MSA' | null // Box 6
  taxYear: number | null
  corrected: boolean
}

export function get5498SAExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 5498-SA (HSA, Archer MSA, or Medicare Advantage MSA Information).

IMPORTANT: This form reports health savings account contributions. Accuracy is critical.

Extract the following fields:

TRUSTEE/ISSUER INFO:
- trusteeName: Trustee or issuer name
- trusteeAddress: Full address
- trusteeTIN: TIN (XX-XXXXXXX)
- trusteePhone: Contact phone

PARTICIPANT INFO:
- participantName: Account holder name
- participantSSN: SSN (XXX-XX-XXXX)
- participantAddress: Full address
- accountNumber: Account number

CONTRIBUTION DATA:
- employerContributions: Box 1 - Employer contributions (including cafeteria plan)
- totalContributions: Box 2 - Total contributions made for the year
- totalHSAContributions: Box 3 - Total HSA/Archer MSA contributions for year
- rolloverContributions: Box 4 - Rollover contributions
- fairMarketValue: Box 5 - Fair market value of account (IMPORTANT)

ACCOUNT TYPE:
- accountType: Box 6 - "HSA", "ARCHER_MSA", or "MA_MSA"

METADATA:
- taxYear, corrected (boolean)

Respond in JSON format:
{
  "trusteeName": "Fidelity Investments",
  "trusteeAddress": "100 Finance St, Boston, MA 02101",
  "trusteeTIN": "XX-XXXXXXX",
  "trusteePhone": "(800) 123-4567",
  "participantName": "JOHN DOE",
  "participantSSN": "XXX-XX-XXXX",
  "participantAddress": "123 Main St, City, ST 12345",
  "accountNumber": "HSA-123456",
  "employerContributions": 1000.00,
  "totalContributions": 3850.00,
  "totalHSAContributions": 3850.00,
  "rolloverContributions": null,
  "fairMarketValue": 12500.00,
  "accountType": "HSA",
  "taxYear": 2024,
  "corrected": false
}

Rules:
1. All monetary values as numbers without $ or commas
2. Box 5 (FMV) is important for account valuation
3. Box 2 total should equal Box 1 + employee contributions
4. Use null for empty/unclear fields, NEVER guess`
}

export function validate5498SAData(data: unknown): data is Form5498SAExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  const requiredFields = ['trusteeName', 'participantName', 'participantSSN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }
  if (typeof d.corrected !== 'boolean') return false
  if (d.fairMarketValue !== null && d.fairMarketValue !== undefined && typeof d.fairMarketValue !== 'number') return false
  return true
}

export const FORM_5498_SA_FIELD_LABELS_VI: Record<string, string> = {
  trusteeName: 'Tên Người ủy thác',
  trusteeAddress: 'Địa chỉ Người ủy thác',
  trusteeTIN: 'TIN Người ủy thác',
  trusteePhone: 'Điện thoại',
  participantName: 'Tên Người tham gia',
  participantSSN: 'SSN Người tham gia',
  participantAddress: 'Địa chỉ',
  accountNumber: 'Số tài khoản',
  employerContributions: 'Đóng góp của chủ lao động (Box 1)',
  totalContributions: 'Tổng đóng góp (Box 2)',
  totalHSAContributions: 'Tổng đóng góp HSA (Box 3)',
  rolloverContributions: 'Đóng góp chuyển tiếp (Box 4)',
  fairMarketValue: 'Giá trị thị trường (Box 5)',
  accountType: 'Loại tài khoản (Box 6)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
}
