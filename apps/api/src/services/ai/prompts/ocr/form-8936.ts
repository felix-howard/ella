/**
 * Form 8936 OCR Extraction Prompt
 * Clean Vehicle Credits
 */

export interface Form8936ExtractedData {
  taxpayerName: string | null
  taxpayerSSN: string | null

  // Vehicle Information
  vehicles: Array<{
    vehicleYear: number | null
    vehicleMake: string | null
    vehicleModel: string | null
    vehicleVin: string | null
    datePlacedInService: string | null
    isNewVehicle: boolean
    acquisitionCost: number | null
  }>

  // New Clean Vehicle Credit (Section 30D)
  newVehicleMSRP: number | null              // Must be ≤ limit
  batteryCapacity: number | null             // kWh
  criticalMineralsCredit: number | null      // Up to $3,750
  batteryComponentsCredit: number | null     // Up to $3,750
  newVehicleCredit: number | null            // Line 7 (max $7,500)

  // Previously Owned Clean Vehicle (Section 25E)
  usedVehiclePrice: number | null
  usedVehicleCredit: number | null           // Max $4,000

  // Total
  cleanVehicleCredit: number | null          // CRITICAL → Schedule 3

  // Income Limits
  modifiedAGI: number | null
  exceedsIncomeLimit: boolean | null

  taxYear: number | null
}

export function getForm8936ExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 8936 (Clean Vehicle Credits).

IMPORTANT: Credits for new ($7,500 max) and used ($4,000 max) electric vehicles. Income/MSRP limits apply.

Extract the following fields:

TAXPAYER INFO:
- taxpayerName, taxpayerSSN (XXX-XX-XXXX)

VEHICLE INFORMATION:
- vehicles: Array of { vehicleYear, vehicleMake, vehicleModel, vehicleVin, datePlacedInService (YYYY-MM-DD), isNewVehicle, acquisitionCost }

NEW CLEAN VEHICLE (30D):
- newVehicleMSRP (must be under MSRP limit)
- batteryCapacity (kWh)
- criticalMineralsCredit (up to $3,750)
- batteryComponentsCredit (up to $3,750)
- newVehicleCredit: Line 7 (max $7,500)

USED CLEAN VEHICLE (25E):
- usedVehiclePrice
- usedVehicleCredit (max $4,000 or 30% of price)

TOTAL:
- cleanVehicleCredit (CRITICAL → Schedule 3)

INCOME:
- modifiedAGI
- exceedsIncomeLimit (true/false)

METADATA:
- taxYear

Respond in JSON format:
{
  "taxpayerName": "JOHN DOE",
  "taxpayerSSN": "XXX-XX-XXXX",
  "vehicles": [
    {"vehicleYear": 2024, "vehicleMake": "Tesla", "vehicleModel": "Model 3", "vehicleVin": "5YJ3E1EA0PF123456", "datePlacedInService": "2024-03-15", "isNewVehicle": true, "acquisitionCost": 42990.00}
  ],
  "newVehicleMSRP": 42990.00,
  "batteryCapacity": 60,
  "criticalMineralsCredit": 3750.00,
  "batteryComponentsCredit": 3750.00,
  "newVehicleCredit": 7500.00,
  "usedVehiclePrice": null,
  "usedVehicleCredit": null,
  "cleanVehicleCredit": 7500.00,
  "modifiedAGI": 120000.00,
  "exceedsIncomeLimit": false,
  "taxYear": 2024
}

Rules:
1. cleanVehicleCredit is most important (flows to Schedule 3)
2. New vehicle max $7,500; used max $4,000
3. MSRP limits: $55K sedans, $80K SUVs/trucks (new)
4. Income limits: $150K single, $300K MFJ (new); $75K/$150K (used)
5. All monetary values as numbers without $ or commas
6. Use null for empty fields, NEVER guess`
}

export function validateForm8936Data(data: unknown): data is Form8936ExtractedData {
  if (!data || typeof data !== 'object') return false
  const d = data as Record<string, unknown>
  if (!('taxpayerName' in d)) return false
  if (!Array.isArray(d.vehicles)) return false
  if (d.cleanVehicleCredit !== null && d.cleanVehicleCredit !== undefined && typeof d.cleanVehicleCredit !== 'number') return false
  return true
}

export const FORM_8936_FIELD_LABELS_VI: Record<string, string> = {
  taxpayerName: 'Tên Người nộp thuế',
  taxpayerSSN: 'SSN Người nộp thuế',
  newVehicleMSRP: 'MSRP xe mới',
  criticalMineralsCredit: 'Tín dụng khoáng sản quan trọng',
  batteryComponentsCredit: 'Tín dụng linh kiện pin',
  newVehicleCredit: 'Tín dụng xe mới (Dòng 7)',
  usedVehicleCredit: 'Tín dụng xe cũ',
  cleanVehicleCredit: 'Tổng tín dụng xe sạch',
  taxYear: 'Năm thuế',
}
