export interface PayrollReportExtractedData {
  businessName: string | null
  businessEIN: string | null
  reportPeriod: string | null
  totalGrossWages: number | null
  totalFederalWithheld: number | null
  totalStateWithheld: number | null
  totalSocialSecurity: number | null
  totalMedicare: number | null
  totalEmployees: number | null
  totalNetPay: number | null
}

export function getPayrollReportExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from payroll reports and summaries used for tax preparation and compliance.

Extract all relevant information and return a JSON object with these fields:
- businessName: name of the employer or business as shown on the report
- businessEIN: Employer Identification Number in format XX-XXXXXXX, or null if not shown
- reportPeriod: payroll period covered (e.g. "Q1 2023", "January 2023", "2023 Annual")
- totalGrossWages: total gross wages paid to all employees as a number
- totalFederalWithheld: total federal income tax withheld from all employees as a number
- totalStateWithheld: total state income tax withheld from all employees as a number
- totalSocialSecurity: total Social Security tax withheld (employee portion) as a number
- totalMedicare: total Medicare tax withheld (employee portion) as a number
- totalEmployees: total number of employees included in this report as a number
- totalNetPay: total net pay disbursed to all employees as a number

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- EIN format should be XX-XXXXXXX (9 digits with dash after second digit)
- totalNetPay = totalGrossWages minus all withholdings if not directly stated
- Return only valid JSON, no markdown or explanation

Return format:
{
  "businessName": "string or null",
  "businessEIN": "string or null",
  "reportPeriod": "string or null",
  "totalGrossWages": number or null,
  "totalFederalWithheld": number or null,
  "totalStateWithheld": number or null,
  "totalSocialSecurity": number or null,
  "totalMedicare": number or null,
  "totalEmployees": number or null,
  "totalNetPay": number or null
}`
}

export function validatePayrollReportData(data: unknown): data is PayrollReportExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'businessName' in d
}

export const PAYROLL_REPORT_FIELD_LABELS_VI: Record<string, string> = {
  businessName: 'Tên doanh nghiệp',
  businessEIN: 'Mã số thuế doanh nghiệp (EIN)',
  reportPeriod: 'Kỳ báo cáo',
  totalGrossWages: 'Tổng lương gộp',
  totalFederalWithheld: 'Tổng thuế liên bang đã khấu trừ',
  totalStateWithheld: 'Tổng thuế tiểu bang đã khấu trừ',
  totalSocialSecurity: 'Tổng An sinh xã hội đã khấu trừ',
  totalMedicare: 'Tổng Medicare đã khấu trừ',
  totalEmployees: 'Tổng số nhân viên',
  totalNetPay: 'Tổng lương thực nhận',
}
