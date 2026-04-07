export interface DepreciationAsset {
  description: string | null
  dateAcquired: string | null
  costBasis: number | null
  method: string | null
  recoveryPeriod: string | null
  priorDepreciation: number | null
  currentDepreciation: number | null
  remainingBasis: number | null
}

export interface DepreciationScheduleExtractedData {
  businessName: string | null
  taxYear: number | null
  assets: DepreciationAsset[]
  totalDepreciation: number | null
}

export function getDepreciationScheduleExtractionPrompt(): string {
  return `You are an expert OCR system specialized in extracting data from depreciation schedules used in business tax returns (IRS Form 4562 and supporting worksheets).

Extract all relevant information and return a JSON object with these fields:
- businessName: name of the business or entity as shown on the schedule
- taxYear: tax year of the schedule as a number (e.g. 2023)
- assets: array of asset objects, each containing:
  - description: asset description or name
  - dateAcquired: date asset was placed in service in ISO format (YYYY-MM-DD)
  - costBasis: original cost or basis of the asset as a number
  - method: depreciation method (e.g. "MACRS", "ACRS", "Straight-Line", "200DB", "150DB")
  - recoveryPeriod: recovery period (e.g. "5-year", "7-year", "39-year", "27.5-year")
  - priorDepreciation: total depreciation taken in prior years as a number
  - currentDepreciation: depreciation amount for current tax year as a number
  - remainingBasis: remaining undepreciated basis as a number
- totalDepreciation: total depreciation for all assets in current year as a number

Rules:
- Remove all currency symbols and commas from numeric values
- Return null for any field not found in the document
- If no assets are listed, return an empty array for assets
- totalDepreciation should equal the sum of all currentDepreciation values
- Return only valid JSON, no markdown or explanation

Return format:
{
  "businessName": "string or null",
  "taxYear": number or null,
  "assets": [
    {
      "description": "string or null",
      "dateAcquired": "YYYY-MM-DD or null",
      "costBasis": number or null,
      "method": "string or null",
      "recoveryPeriod": "string or null",
      "priorDepreciation": number or null,
      "currentDepreciation": number or null,
      "remainingBasis": number or null
    }
  ],
  "totalDepreciation": number or null
}`
}

export function validateDepreciationScheduleData(data: unknown): data is DepreciationScheduleExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  return 'assets' in d && Array.isArray(d['assets'])
}

export const DEPRECIATION_SCHEDULE_FIELD_LABELS_VI: Record<string, string> = {
  businessName: 'Tên doanh nghiệp',
  taxYear: 'Năm tính thuế',
  assets: 'Danh sách tài sản',
  totalDepreciation: 'Tổng khấu hao',
  description: 'Mô tả tài sản',
  dateAcquired: 'Ngày mua/sử dụng',
  costBasis: 'Chi phí ban đầu',
  method: 'Phương pháp khấu hao',
  recoveryPeriod: 'Thời gian khấu hao',
  priorDepreciation: 'Khấu hao lũy kế trước đó',
  currentDepreciation: 'Khấu hao năm hiện tại',
  remainingBasis: 'Giá trị còn lại',
}
