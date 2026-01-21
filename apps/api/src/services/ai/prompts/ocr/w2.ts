/**
 * W2 OCR Extraction Prompt
 * Extracts structured data from W-2 Wage and Tax Statement forms
 */

/**
 * W2 extracted data structure
 * Matches IRS Form W-2 box layout
 */
export interface W2ExtractedData {
  // Employer Information (Boxes a-c, 1)
  employerEIN: string | null // Box b - Employer identification number
  employerName: string | null // Box c - Employer's name
  employerAddress: string | null // Box c - Employer's address
  controlNumber: string | null // Box d - Control number

  // Employee Information (Boxes e-f)
  employeeSSN: string | null // Box a - Employee's social security number
  employeeName: string | null // Box e - Employee's name
  employeeAddress: string | null // Box f - Employee's address

  // Wages and Compensation (Boxes 1-11)
  wagesTipsOther: number | null // Box 1 - Wages, tips, other compensation
  federalIncomeTaxWithheld: number | null // Box 2 - Federal income tax withheld
  socialSecurityWages: number | null // Box 3 - Social security wages
  socialSecurityTaxWithheld: number | null // Box 4 - Social security tax withheld
  medicareWages: number | null // Box 5 - Medicare wages and tips
  medicareTaxWithheld: number | null // Box 6 - Medicare tax withheld
  socialSecurityTips: number | null // Box 7 - Social security tips
  allocatedTips: number | null // Box 8 - Allocated tips
  dependentCareBenefits: number | null // Box 10 - Dependent care benefits
  nonQualifiedPlans: number | null // Box 11 - Nonqualified plans

  // State/Local Tax Information (Boxes 15-20)
  stateTaxInfo: Array<{
    state: string | null // Box 15 - State
    stateId: string | null // Box 15 - Employer's state ID number
    stateWages: number | null // Box 16 - State wages, tips, etc.
    stateTaxWithheld: number | null // Box 17 - State income tax
  }>

  localTaxInfo: Array<{
    localityName: string | null // Box 20 - Locality name
    localWages: number | null // Box 18 - Local wages, tips, etc.
    localTaxWithheld: number | null // Box 19 - Local income tax
  }>

  // Additional Information (Boxes 12-14)
  box12Codes: Array<{
    code: string // e.g., "D", "DD", "W"
    amount: number | null
  }>
  box13Flags: {
    statutoryEmployee: boolean
    retirementPlan: boolean
    thirdPartySickPay: boolean
  }
  box14Other: string | null // Box 14 - Other

  // Metadata
  taxYear: number | null
  formVariant: 'W-2' | 'W-2c' | null // W-2c is corrected form
}

/**
 * Generate W2 OCR extraction prompt
 */
export function getW2ExtractionPrompt(): string {
  return `You are an OCR system. Your task is to READ and EXTRACT text from this IRS Form W-2 image.

CRITICAL INSTRUCTIONS:
- ONLY extract text that is ACTUALLY VISIBLE in this specific document image
- DO NOT invent, guess, or generate any data
- DO NOT use example or placeholder values
- If a field is blank, empty, or unreadable, use null
- READ the actual text from the image carefully

FORM LAYOUT - Extract these fields by reading the actual document:

EMPLOYER INFORMATION:
- employerEIN: Read from Box b (format: XX-XXXXXXX)
- employerName: Read from Box c exactly as printed
- employerAddress: Read full address from Box c
- controlNumber: Read from Box d if present, otherwise null

EMPLOYEE INFORMATION:
- employeeSSN: Read from Box a (format: XXX-XX-XXXX)
- employeeName: Read from Box e exactly as printed
- employeeAddress: Read full address from Box f

WAGES AND TAXES (read the dollar amounts from each box):
- wagesTipsOther: Read amount from Box 1
- federalIncomeTaxWithheld: Read amount from Box 2
- socialSecurityWages: Read amount from Box 3
- socialSecurityTaxWithheld: Read amount from Box 4
- medicareWages: Read amount from Box 5
- medicareTaxWithheld: Read amount from Box 6
- socialSecurityTips: Read from Box 7 if present
- allocatedTips: Read from Box 8 if present
- dependentCareBenefits: Read from Box 10 if present
- nonQualifiedPlans: Read from Box 11 if present

STATE/LOCAL TAX (Boxes 15-20):
- stateTaxInfo: Array for each state entry
- localTaxInfo: Array for each local entry

BOX 12 CODES:
- box12Codes: Read each code letter and amount

BOX 13 CHECKBOXES:
- box13Flags: Check if each box is marked

BOX 14:
- box14Other: Read any text in Box 14

METADATA:
- taxYear: Read the year from the form
- formVariant: "W-2" or "W-2c"

OUTPUT FORMAT (JSON):
{
  "employerEIN": "[read from document]",
  "employerName": "[read from document]",
  "employerAddress": "[read from document]",
  "controlNumber": null,
  "employeeSSN": "[read from document]",
  "employeeName": "[read from document]",
  "employeeAddress": "[read from document]",
  "wagesTipsOther": [number from Box 1],
  "federalIncomeTaxWithheld": [number from Box 2],
  "socialSecurityWages": [number from Box 3],
  "socialSecurityTaxWithheld": [number from Box 4],
  "medicareWages": [number from Box 5],
  "medicareTaxWithheld": [number from Box 6],
  "socialSecurityTips": null,
  "allocatedTips": null,
  "dependentCareBenefits": null,
  "nonQualifiedPlans": null,
  "stateTaxInfo": [],
  "localTaxInfo": [],
  "box12Codes": [],
  "box13Flags": {
    "statutoryEmployee": false,
    "retirementPlan": false,
    "thirdPartySickPay": false
  },
  "box14Other": null,
  "taxYear": [year],
  "formVariant": "W-2"
}

IMPORTANT REMINDERS:
- Monetary values: numbers only (50000.00 not "$50,000.00")
- SSN/EIN: include dashes (XXX-XX-XXXX, XX-XXXXXXX)
- Empty fields: use null, NOT made-up values
- READ the actual document - do not generate fake data`
}

/**
 * Validate W2 extracted data
 */
export function validateW2Data(data: unknown): data is W2ExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists (values can be null)
  const requiredFields = [
    'employerEIN',
    'employerName',
    'employeeSSN',
    'employeeName',
    'wagesTipsOther',
    'federalIncomeTaxWithheld',
  ]

  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false
  if (!Array.isArray(d.localTaxInfo)) return false
  if (!Array.isArray(d.box12Codes)) return false

  // Validate box13Flags
  if (!d.box13Flags || typeof d.box13Flags !== 'object') return false

  return true
}

/**
 * Get field labels in Vietnamese for W2
 */
export const W2_FIELD_LABELS_VI: Record<string, string> = {
  employerEIN: 'EIN Công ty',
  employerName: 'Tên Công ty',
  employerAddress: 'Địa chỉ Công ty',
  controlNumber: 'Số kiểm soát',
  employeeSSN: 'SSN Nhân viên',
  employeeName: 'Tên Nhân viên',
  employeeAddress: 'Địa chỉ Nhân viên',
  wagesTipsOther: 'Lương, Tip, Khác (Box 1)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 2)',
  socialSecurityWages: 'Lương FICA (Box 3)',
  socialSecurityTaxWithheld: 'Thuế FICA đã khấu trừ (Box 4)',
  medicareWages: 'Lương Medicare (Box 5)',
  medicareTaxWithheld: 'Thuế Medicare đã khấu trừ (Box 6)',
  socialSecurityTips: 'Tip FICA (Box 7)',
  allocatedTips: 'Tip phân bổ (Box 8)',
  dependentCareBenefits: 'Phúc lợi chăm sóc người phụ thuộc (Box 10)',
  nonQualifiedPlans: 'Kế hoạch không đủ điều kiện (Box 11)',
  state: 'Tiểu bang',
  stateId: 'ID Tiểu bang',
  stateWages: 'Lương Tiểu bang (Box 16)',
  stateTaxWithheld: 'Thuế Tiểu bang (Box 17)',
  localityName: 'Tên Địa phương',
  localWages: 'Lương Địa phương (Box 18)',
  localTaxWithheld: 'Thuế Địa phương (Box 19)',
  taxYear: 'Năm thuế',
}
