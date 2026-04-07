export interface ClosingDisclosureExtractedData {
  propertyAddress: string | null
  closingDate: string | null
  buyerName: string | null
  sellerName: string | null
  purchasePrice: number | null
  loanAmount: number | null
  downPayment: number | null
  interestRate: number | null
  loanType: string | null
  mortgagePoints: number | null
  titleInsurance: number | null
  recordingFees: number | null
  propertyTaxProration: number | null
  totalClosingCosts: number | null
}

export function getClosingDisclosureExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from Closing Disclosure forms (used in U.S. real estate transactions).

Extract all available fields and return a JSON object with these fields:
- propertyAddress: full property address
- closingDate: closing date (YYYY-MM-DD format if possible)
- buyerName: buyer's full name
- sellerName: seller's full name
- purchasePrice: purchase price as a number (no currency symbols)
- loanAmount: loan amount as a number
- downPayment: down payment as a number
- interestRate: interest rate as a decimal number (e.g. 0.065 for 6.5%)
- loanType: loan type (e.g. Conventional, FHA, VA)
- mortgagePoints: mortgage discount points as a number
- titleInsurance: title insurance cost as a number
- recordingFees: recording fees as a number
- propertyTaxProration: property tax proration as a number
- totalClosingCosts: total closing costs as a number

Rules:
- Return ONLY valid JSON, no markdown or extra text
- Use null for missing or unreadable fields
- Convert all monetary values to plain numbers (remove $, commas)
- Convert percentages to decimals for interestRate

Example output:
{
  "propertyAddress": "123 Main St, Austin, TX 78701",
  "closingDate": "2024-03-15",
  "buyerName": "John Smith",
  "sellerName": "Jane Doe",
  "purchasePrice": 450000,
  "loanAmount": 360000,
  "downPayment": 90000,
  "interestRate": 0.065,
  "loanType": "Conventional",
  "mortgagePoints": 1800,
  "titleInsurance": 1200,
  "recordingFees": 150,
  "propertyTaxProration": 2400,
  "totalClosingCosts": 12500
}`
}

export function validateClosingDisclosureData(data: unknown): data is ClosingDisclosureExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'buyerName' in d
}

export const CLOSING_DISCLOSURE_FIELD_LABELS_VI: Record<string, string> = {
  propertyAddress: 'Địa chỉ bất động sản',
  closingDate: 'Ngày đóng',
  buyerName: 'Tên người mua',
  sellerName: 'Tên người bán',
  purchasePrice: 'Giá mua',
  loanAmount: 'Số tiền vay',
  downPayment: 'Tiền đặt cọc',
  interestRate: 'Lãi suất',
  loanType: 'Loại vay',
  mortgagePoints: 'Điểm thế chấp',
  titleInsurance: 'Bảo hiểm quyền sở hữu',
  recordingFees: 'Phí đăng ký',
  propertyTaxProration: 'Phân bổ thuế bất động sản',
  totalClosingCosts: 'Tổng chi phí đóng',
}
