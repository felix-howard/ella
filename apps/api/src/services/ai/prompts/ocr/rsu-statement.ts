export interface RsuStatementExtractedData {
  companyName: string | null
  employeeName: string | null
  grantDate: string | null
  totalUnitsGranted: number | null
  vestingSchedule: string | null
  vestedUnits: number | null
  unvestedUnits: number | null
  grantPrice: number | null
  currentPrice: number | null
}

export function getRsuStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from RSU (Restricted Stock Unit) Statements or Grant Notices.

Extract the following fields and return a single JSON object:

{
  "companyName": "Acme Corp",
  "employeeName": "John Doe",
  "grantDate": "2022-03-01",
  "totalUnitsGranted": 4000,
  "vestingSchedule": "25% annually over 4 years",
  "vestedUnits": 2000,
  "unvestedUnits": 2000,
  "grantPrice": 45.00,
  "currentPrice": 72.50
}

Rules:
- Use null for any field not found or not legible
- Never guess or infer values not present in the document
- Return numbers without $ signs or commas (e.g. 45.00 not $45.00)
- Dates must be in YYYY-MM-DD format
- totalUnitsGranted, vestedUnits, unvestedUnits must be whole numbers (share counts)
- grantPrice: fair market value or closing price on grant date if shown
- currentPrice: current market value per share if shown on statement
- vestingSchedule: summarize vesting terms as described in the document`
}

export function validateRsuStatementData(data: unknown): data is RsuStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.employeeName !== 'string' && d.employeeName !== null) return false
  if (d.employeeName === undefined) return false
  return true
}

export const RSU_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  companyName: 'Tên công ty',
  employeeName: 'Tên nhân viên',
  grantDate: 'Ngày cấp RSU',
  totalUnitsGranted: 'Tổng số RSU được cấp',
  vestingSchedule: 'Lịch vesting',
  vestedUnits: 'Số RSU đã vesting',
  unvestedUnits: 'Số RSU chưa vesting',
  grantPrice: 'Giá cổ phiếu tại ngày cấp',
  currentPrice: 'Giá cổ phiếu hiện tại',
}
