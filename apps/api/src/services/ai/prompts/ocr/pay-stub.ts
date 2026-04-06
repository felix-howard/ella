export interface PayStubExtractedData {
  employerName: string | null
  employerEIN: string | null
  employeeName: string | null
  employeeSSN: string | null
  payPeriodStart: string | null
  payPeriodEnd: string | null
  payDate: string | null
  grossPay: number | null
  federalWithheld: number | null
  stateWithheld: number | null
  socialSecurityWithheld: number | null
  medicareWithheld: number | null
  retirementDeduction: number | null
  healthInsuranceDeduction: number | null
  netPay: number | null
  ytdGross: number | null
  ytdFederalWithheld: number | null
}

export function getPayStubExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from Pay Stubs / Earnings Statements.

Extract the following fields and return a single JSON object:

{
  "employerName": "Acme Corp",
  "employerEIN": "12-3456789",
  "employeeName": "John Doe",
  "employeeSSN": "***-**-1234",
  "payPeriodStart": "2024-01-01",
  "payPeriodEnd": "2024-01-15",
  "payDate": "2024-01-20",
  "grossPay": 3500.00,
  "federalWithheld": 420.00,
  "stateWithheld": 175.00,
  "socialSecurityWithheld": 217.00,
  "medicareWithheld": 50.75,
  "retirementDeduction": 175.00,
  "healthInsuranceDeduction": 120.00,
  "netPay": 2342.25,
  "ytdGross": 7000.00,
  "ytdFederalWithheld": 840.00
}

Rules:
- Use null for any field not found or not legible
- Never guess or infer values not present in the document
- Return numbers without $ signs or commas (e.g. 3500.00 not $3,500.00)
- Dates must be in YYYY-MM-DD format
- SSN should be masked if already masked on document; extract as shown
- EIN format: XX-XXXXXXX
- YTD = Year-to-Date cumulative totals`
}

export function validatePayStubData(data: unknown): data is PayStubExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (typeof d.employeeName !== 'string' && d.employeeName !== null) return false
  if (d.employeeName === undefined) return false
  return true
}

export const PAY_STUB_FIELD_LABELS_VI: Record<string, string> = {
  employerName: 'Tên công ty',
  employerEIN: 'Mã số thuế công ty (EIN)',
  employeeName: 'Tên nhân viên',
  employeeSSN: 'Số an sinh xã hội nhân viên',
  payPeriodStart: 'Ngày bắt đầu kỳ lương',
  payPeriodEnd: 'Ngày kết thúc kỳ lương',
  payDate: 'Ngày trả lương',
  grossPay: 'Lương gộp',
  federalWithheld: 'Thuế liên bang khấu trừ',
  stateWithheld: 'Thuế tiểu bang khấu trừ',
  socialSecurityWithheld: 'An sinh xã hội khấu trừ',
  medicareWithheld: 'Medicare khấu trừ',
  retirementDeduction: 'Khấu trừ hưu trí',
  healthInsuranceDeduction: 'Khấu trừ bảo hiểm y tế',
  netPay: 'Lương thực nhận',
  ytdGross: 'Lương gộp từ đầu năm',
  ytdFederalWithheld: 'Thuế liên bang khấu trừ từ đầu năm',
}
