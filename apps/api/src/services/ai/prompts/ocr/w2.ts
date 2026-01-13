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
  return `You are an expert OCR system for extracting data from IRS Form W-2 (Wage and Tax Statement). Extract all data from this W-2 form image accurately.

IMPORTANT: This is a tax document. Accuracy is critical. If a value is unclear or not present, use null rather than guessing.

Extract the following fields:

EMPLOYER INFORMATION:
- employerEIN: Box b - Employer's federal EIN (format: XX-XXXXXXX)
- employerName: Box c - Employer's name
- employerAddress: Box c - Full employer address
- controlNumber: Box d - Control number (if present)

EMPLOYEE INFORMATION:
- employeeSSN: Box a - Employee's SSN (format: XXX-XX-XXXX)
- employeeName: Box e - Employee's first name, middle initial, last name
- employeeAddress: Box f - Employee's full address

WAGES AND TAXES (numeric values, no dollar signs or commas):
- wagesTipsOther: Box 1
- federalIncomeTaxWithheld: Box 2
- socialSecurityWages: Box 3
- socialSecurityTaxWithheld: Box 4
- medicareWages: Box 5
- medicareTaxWithheld: Box 6
- socialSecurityTips: Box 7 (if present)
- allocatedTips: Box 8 (if present)
- dependentCareBenefits: Box 10 (if present)
- nonQualifiedPlans: Box 11 (if present)

STATE/LOCAL TAX (may have multiple entries):
- stateTaxInfo: Array of { state, stateId, stateWages, stateTaxWithheld }
- localTaxInfo: Array of { localityName, localWages, localTaxWithheld }

BOX 12 CODES (may have multiple):
- box12Codes: Array of { code, amount }
  Common codes: D (401k), DD (healthcare), W (HSA)

BOX 13 CHECKBOXES:
- box13Flags: { statutoryEmployee, retirementPlan, thirdPartySickPay }

BOX 14 OTHER:
- box14Other: Any text in Box 14

METADATA:
- taxYear: The tax year shown on the form
- formVariant: "W-2" or "W-2c" (corrected)

Respond in JSON format:
{
  "employerEIN": "XX-XXXXXXX",
  "employerName": "Company Name",
  "employerAddress": "123 Street, City, ST 12345",
  "controlNumber": null,
  "employeeSSN": "XXX-XX-XXXX",
  "employeeName": "First M Last",
  "employeeAddress": "456 Ave, City, ST 67890",
  "wagesTipsOther": 50000.00,
  "federalIncomeTaxWithheld": 7500.00,
  "socialSecurityWages": 50000.00,
  "socialSecurityTaxWithheld": 3100.00,
  "medicareWages": 50000.00,
  "medicareTaxWithheld": 725.00,
  "socialSecurityTips": null,
  "allocatedTips": null,
  "dependentCareBenefits": null,
  "nonQualifiedPlans": null,
  "stateTaxInfo": [
    {
      "state": "CA",
      "stateId": "XXX-XXXX-X",
      "stateWages": 50000.00,
      "stateTaxWithheld": 2500.00
    }
  ],
  "localTaxInfo": [],
  "box12Codes": [
    { "code": "D", "amount": 5000.00 },
    { "code": "DD", "amount": 1200.00 }
  ],
  "box13Flags": {
    "statutoryEmployee": false,
    "retirementPlan": true,
    "thirdPartySickPay": false
  },
  "box14Other": null,
  "taxYear": 2024,
  "formVariant": "W-2"
}

Rules:
1. All monetary values should be numbers without $ or commas
2. Use null for empty or unclear fields, NEVER guess
3. SSN and EIN should include dashes in correct format
4. Extract ALL entries for multi-state or multi-local situations
5. Box 12 can have up to 4 code/amount pairs`
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
