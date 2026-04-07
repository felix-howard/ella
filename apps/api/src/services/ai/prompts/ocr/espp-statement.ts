export interface EsppStatementExtractedData {
  companyName: string | null
  employeeName: string | null
  offeringPeriod: string | null
  contributionAmount: number | null
  sharesPurchased: number | null
  purchasePrice: number | null
  fmvAtPurchase: number | null
  purchaseDate: string | null
  discountPercentage: number | null
}

export function getEsppStatementExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from ESPP (Employee Stock Purchase Plan) Statements or Purchase Confirmations.

Extract the following fields and return a single JSON object:

{
  "companyName": "Acme Corp",
  "employeeName": "Jane Doe",
  "offeringPeriod": "2024-01-01 to 2024-06-30",
  "contributionAmount": 2500.00,
  "sharesPurchased": 42,
  "purchasePrice": 59.50,
  "fmvAtPurchase": 85.00,
  "purchaseDate": "2024-06-30",
  "discountPercentage": 15
}

Rules:
- Use null for any field not found or not legible
- Never guess or infer values not present in the document
- Return numbers without $ signs, % signs, or commas (e.g. 59.50 not $59.50, 15 not 15%)
- Dates must be in YYYY-MM-DD format
- offeringPeriod: describe the offering/purchase period as shown (e.g. "2024-01-01 to 2024-06-30")
- sharesPurchased must be a whole number
- discountPercentage: the ESPP discount rate as a plain number (e.g. 15 for 15%)
- fmvAtPurchase: fair market value per share on the purchase date
- purchasePrice: actual price paid per share after discount`
}

export function validateEsppStatementData(data: unknown): data is EsppStatementExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.employeeName !== 'string' && d.employeeName !== null) return false
  if (d.employeeName === undefined) return false
  return true
}

export const ESPP_STATEMENT_FIELD_LABELS_VI: Record<string, string> = {
  companyName: 'Tên công ty',
  employeeName: 'Tên nhân viên',
  offeringPeriod: 'Kỳ chào bán',
  contributionAmount: 'Số tiền đóng góp',
  sharesPurchased: 'Số cổ phiếu đã mua',
  purchasePrice: 'Giá mua cổ phiếu',
  fmvAtPurchase: 'Giá thị trường tại ngày mua',
  purchaseDate: 'Ngày mua',
  discountPercentage: 'Tỷ lệ chiết khấu (%)',
}
