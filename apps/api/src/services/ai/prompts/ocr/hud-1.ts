export interface Hud1ExtractedData {
  propertyAddress: string | null
  settlementDate: string | null
  buyerName: string | null
  sellerName: string | null
  purchasePrice: number | null
  loanAmount: number | null
  depositAmount: number | null
  interestRate: number | null
  mortgagePoints: number | null
  titleCharges: number | null
  recordingFees: number | null
  transferTaxes: number | null
  totalSettlementChargesBuyer: number | null
  totalSettlementChargesSeller: number | null
}

export function getHud1ExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from HUD-1 Settlement Statement forms (used in U.S. real estate closings).

Extract all available fields and return a JSON object with these fields:
- propertyAddress: full property address
- settlementDate: settlement/closing date (YYYY-MM-DD format if possible)
- buyerName: buyer's full name
- sellerName: seller's full name
- purchasePrice: purchase price as a number (no currency symbols)
- loanAmount: new loan amount as a number
- depositAmount: earnest money deposit as a number
- interestRate: interest rate as a decimal number (e.g. 0.07 for 7%)
- mortgagePoints: mortgage discount points dollar amount as a number
- titleCharges: total title charges as a number
- recordingFees: recording and transfer fees as a number
- transferTaxes: government recording or transfer taxes as a number
- totalSettlementChargesBuyer: total settlement charges paid by buyer (line 1400) as a number
- totalSettlementChargesSeller: total settlement charges paid by seller as a number

Rules:
- Return ONLY valid JSON, no markdown or extra text
- Use null for missing or unreadable fields
- Convert all monetary values to plain numbers (remove $, commas)
- Convert percentages to decimals for interestRate

Example output:
{
  "propertyAddress": "456 Oak Ave, Dallas, TX 75201",
  "settlementDate": "2024-04-01",
  "buyerName": "Michael Johnson",
  "sellerName": "Sarah Williams",
  "purchasePrice": 320000,
  "loanAmount": 256000,
  "depositAmount": 5000,
  "interestRate": 0.0725,
  "mortgagePoints": 2560,
  "titleCharges": 950,
  "recordingFees": 200,
  "transferTaxes": 640,
  "totalSettlementChargesBuyer": 9800,
  "totalSettlementChargesSeller": 4200
}`
}

export function validateHud1Data(data: unknown): data is Hud1ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'buyerName' in d
}

export const HUD_1_FIELD_LABELS_VI: Record<string, string> = {
  propertyAddress: 'Địa chỉ bất động sản',
  settlementDate: 'Ngày thanh toán',
  buyerName: 'Tên người mua',
  sellerName: 'Tên người bán',
  purchasePrice: 'Giá mua',
  loanAmount: 'Số tiền vay',
  depositAmount: 'Tiền đặt cọc',
  interestRate: 'Lãi suất',
  mortgagePoints: 'Điểm thế chấp',
  titleCharges: 'Phí quyền sở hữu',
  recordingFees: 'Phí đăng ký',
  transferTaxes: 'Thuế chuyển nhượng',
  totalSettlementChargesBuyer: 'Tổng phí thanh toán (người mua)',
  totalSettlementChargesSeller: 'Tổng phí thanh toán (người bán)',
}
