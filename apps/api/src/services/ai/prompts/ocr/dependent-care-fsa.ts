export interface DependentCareFsaExtractedData {
  planName: string | null
  employerName: string | null
  participantName: string | null
  taxYear: number | null
  totalContributions: number | null
  totalClaims: number | null
  forfeitedAmount: number | null
  remainingBalance: number | null
}

export function getDependentCareFsaExtractionPrompt(): string {
  return `You are an expert OCR system specializing in Dependent Care Flexible Spending Account (FSA) annual summary statements issued by plan administrators and employers.

Extract all available data from this Dependent Care FSA statement and return a JSON object with these fields:

- planName: Name of the FSA plan or plan administrator (string)
- employerName: Name of the employer sponsoring the Dependent Care FSA (string)
- participantName: Full name of the FSA participant/employee (string)
- taxYear: Plan year or tax year this statement covers (number, e.g. 2023)
- totalContributions: Total amount contributed to the Dependent Care FSA during the plan year in USD (number)
- totalClaims: Total amount of claims reimbursed from the FSA during the plan year in USD (number)
- forfeitedAmount: Amount forfeited under the use-it-or-lose-it rule at end of plan year in USD (number)
- remainingBalance: Remaining balance in the FSA account at the end of the plan year in USD (number)

Rules:
- All dollar amounts must be numbers without currency symbols or commas
- The IRS annual contribution limit for Dependent Care FSA is $5,000 per household ($2,500 if married filing separately)
- FSA funds must generally be used by the plan year end or a grace period — unused funds are forfeited
- If forfeitedAmount is not shown explicitly, it may be inferred as totalContributions - totalClaims - remainingBalance
- If a field is not present in the document, use null
- Return only valid JSON, no markdown or explanation

Return JSON format:
{
  "planName": "string or null",
  "employerName": "string or null",
  "participantName": "string or null",
  "taxYear": number or null,
  "totalContributions": number or null,
  "totalClaims": number or null,
  "forfeitedAmount": number or null,
  "remainingBalance": number or null
}`
}

export function validateDependentCareFsaData(data: unknown): data is DependentCareFsaExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'participantName' in d
}

export const DEPENDENT_CARE_FSA_FIELD_LABELS_VI: Record<string, string> = {
  planName: 'Tên kế hoạch FSA',
  employerName: 'Tên nhà tuyển dụng',
  participantName: 'Tên người tham gia',
  taxYear: 'Năm thuế',
  totalContributions: 'Tổng đóng góp',
  totalClaims: 'Tổng yêu cầu hoàn trả',
  forfeitedAmount: 'Số tiền bị mất (use-it-or-lose-it)',
  remainingBalance: 'Số dư còn lại',
}
