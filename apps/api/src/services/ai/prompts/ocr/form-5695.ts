/**
 * Form 5695 OCR Extraction Prompt
 * Residential Energy Credits
 */

export interface Form5695ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Part I: Residential Clean Energy Credit
  solarElectric: number | null               // Line 1
  solarWaterHeating: number | null           // Line 2
  fuelCellProperty: number | null            // Line 3
  smallWindEnergy: number | null             // Line 4
  geothermalHeatPump: number | null          // Line 5
  batteryStorageTechnology: number | null    // Line 6
  qualifiedCleanEnergyTotal: number | null   // Line 7
  cleanEnergyCredit: number | null           // Line 15 (30% of Line 7) → Schedule 3

  // Part II: Energy Efficient Home Improvement Credit
  qualifiedEnergyProperty: number | null     // Line 17 (insulation, etc.)
  residentialEnergyProperty: number | null   // Line 18
  doorsWindows: number | null                // Line 19
  heatPumps: number | null                   // Line 20
  biomassStoves: number | null               // Line 21
  homeEnergyAudit: number | null             // Line 22
  totalHomeImprovement: number | null        // Line 24
  homeImprovementCredit: number | null       // Line 32 → Schedule 3

  // Total Credit
  totalResidentialEnergyCredit: number | null // Line 33

  taxYear: number | null
}

export function getForm5695ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 5695 (Residential Energy Credits).

IMPORTANT: This form calculates energy credits for solar, wind, geothermal, and home improvements.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

PART I - RESIDENTIAL CLEAN ENERGY CREDIT:
- solarElectric: Line 1 (solar panels)
- solarWaterHeating: Line 2
- fuelCellProperty: Line 3
- smallWindEnergy: Line 4
- geothermalHeatPump: Line 5
- batteryStorageTechnology: Line 6
- qualifiedCleanEnergyTotal: Line 7 (sum of Lines 1-6)
- cleanEnergyCredit: Line 15 (CRITICAL - 30% credit → Schedule 3)

PART II - ENERGY EFFICIENT HOME IMPROVEMENT CREDIT:
- qualifiedEnergyProperty: Line 17 (insulation, exterior doors/windows)
- residentialEnergyProperty: Line 18
- doorsWindows: Line 19
- heatPumps: Line 20 (heat pump, heat pump water heater)
- biomassStoves: Line 21
- homeEnergyAudit: Line 22
- totalHomeImprovement: Line 24
- homeImprovementCredit: Line 32 (CRITICAL → Schedule 3)

TOTAL:
- totalResidentialEnergyCredit: Line 33 (combined credit)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "solarElectric": 25000.00,
  "solarWaterHeating": null,
  "fuelCellProperty": null,
  "smallWindEnergy": null,
  "geothermalHeatPump": null,
  "batteryStorageTechnology": 8000.00,
  "qualifiedCleanEnergyTotal": 33000.00,
  "cleanEnergyCredit": 9900.00,
  "qualifiedEnergyProperty": null,
  "residentialEnergyProperty": null,
  "doorsWindows": null,
  "heatPumps": null,
  "biomassStoves": null,
  "homeEnergyAudit": null,
  "totalHomeImprovement": null,
  "homeImprovementCredit": null,
  "totalResidentialEnergyCredit": 9900.00,
  "taxYear": 2024
}

Rules:
1. Clean Energy Credit (Line 15) = 30% of qualifying costs
2. Home Improvement Credit (Line 32) has annual limits
3. All monetary values as numbers without $ or commas
4. Use null for empty fields, NEVER guess`
}

export function validateForm5695Data(data: unknown): data is Form5695ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (d.cleanEnergyCredit !== null && d.cleanEnergyCredit !== undefined && typeof d.cleanEnergyCredit !== 'number') return false
  if (d.totalResidentialEnergyCredit !== null && d.totalResidentialEnergyCredit !== undefined && typeof d.totalResidentialEnergyCredit !== 'number') return false
  return true
}

export const FORM_5695_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  solarElectric: 'Điện mặt trời (Dòng 1)',
  solarWaterHeating: 'Nước nóng mặt trời (Dòng 2)',
  fuelCellProperty: 'Pin nhiên liệu (Dòng 3)',
  smallWindEnergy: 'Năng lượng gió (Dòng 4)',
  geothermalHeatPump: 'Bơm nhiệt địa nhiệt (Dòng 5)',
  batteryStorageTechnology: 'Pin lưu trữ (Dòng 6)',
  qualifiedCleanEnergyTotal: 'Tổng năng lượng sạch (Dòng 7)',
  cleanEnergyCredit: 'Tín dụng năng lượng sạch (Dòng 15)',
  qualifiedEnergyProperty: 'Cách nhiệt đủ điều kiện (Dòng 17)',
  residentialEnergyProperty: 'Tài sản năng lượng nhà ở (Dòng 18)',
  doorsWindows: 'Cửa ra vào/Cửa sổ (Dòng 19)',
  heatPumps: 'Bơm nhiệt (Dòng 20)',
  biomassStoves: 'Bếp sinh khối (Dòng 21)',
  homeEnergyAudit: 'Kiểm toán năng lượng (Dòng 22)',
  totalHomeImprovement: 'Tổng cải thiện nhà (Dòng 24)',
  homeImprovementCredit: 'Tín dụng cải thiện nhà (Dòng 32)',
  totalResidentialEnergyCredit: 'Tổng tín dụng năng lượng (Dòng 33)',
  taxYear: 'Năm thuế',
}
