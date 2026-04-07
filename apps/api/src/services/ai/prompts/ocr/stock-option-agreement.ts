export interface StockOptionAgreementExtractedData {
  companyName: string | null
  granteeName: string | null
  grantDate: string | null
  totalOptionsGranted: number | null
  exercisePrice: number | null
  vestingStartDate: string | null
  vestingSchedule: string | null
  expirationDate: string | null
  optionType: 'ISO' | 'NSO' | null
}

export function getStockOptionAgreementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Stock Option Agreements (ISO/NSO Grant Agreements).

Extract the following fields and return a single JSON object:

{
  "companyName": "Acme Corp",
  "granteeName": "Jane Smith",
  "grantDate": "2024-01-15",
  "totalOptionsGranted": 10000,
  "exercisePrice": 5.50,
  "vestingStartDate": "2024-01-15",
  "vestingSchedule": "25% after 1 year cliff, then monthly over 36 months",
  "expirationDate": "2034-01-15",
  "optionType": "ISO"
}

Rules:
- Use null for any field not found or not legible
- Never guess or infer values not present in the document
- Return numbers without $ signs or commas (e.g. 5.50 not $5.50)
- Dates must be in YYYY-MM-DD format
- optionType must be exactly "ISO" (Incentive Stock Option) or "NSO" (Non-Qualified Stock Option) or null
- vestingSchedule: summarize the vesting terms as described in the document
- totalOptionsGranted must be a whole number (shares count)`
}

export function validateStockOptionAgreementData(data: unknown): data is StockOptionAgreementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.granteeName !== 'string' && d.granteeName !== null) return false
  if (d.granteeName === undefined) return false
  return true
}

export const STOCK_OPTION_AGREEMENT_FIELD_LABELS_VI: Record<string, string> = {
  companyName: 'Tên công ty',
  granteeName: 'Tên người nhận quyền chọn',
  grantDate: 'Ngày cấp quyền chọn',
  totalOptionsGranted: 'Tổng số quyền chọn được cấp',
  exercisePrice: 'Giá thực hiện quyền chọn',
  vestingStartDate: 'Ngày bắt đầu vesting',
  vestingSchedule: 'Lịch vesting',
  expirationDate: 'Ngày hết hạn',
  optionType: 'Loại quyền chọn (ISO/NSO)',
}
