/**
 * 1099-MISC OCR Extraction Prompt
 * Extracts structured data from IRS Form 1099-MISC (Miscellaneous Information)
 * Reports rents, royalties, prizes, awards, other income
 * Note: Nonemployee compensation moved to 1099-NEC starting 2020
 */

/**
 * 1099-MISC extracted data structure
 * Matches IRS Form 1099-MISC box layout
 */
export interface Form1099MiscExtractedData {
  // Payer Information
  payerName: string | null
  payerAddress: string | null
  payerTIN: string | null
  payerPhone: string | null

  // Recipient Information
  recipientName: string | null
  recipientAddress: string | null
  recipientTIN: string | null
  accountNumber: string | null

  // Income Types (Boxes 1-14)
  rents: number | null // Box 1 - Rents
  royalties: number | null // Box 2 - Royalties
  otherIncome: number | null // Box 3 - Other income
  federalIncomeTaxWithheld: number | null // Box 4 - Federal income tax withheld
  fishingBoatProceeds: number | null // Box 5 - Fishing boat proceeds
  medicalPayments: number | null // Box 6 - Medical and health care payments
  payerMadeDirectSales: boolean // Box 7 - Checkbox for direct sales $5,000+
  substitutePayments: number | null // Box 8 - Substitute payments in lieu of dividends
  cropInsuranceProceeds: number | null // Box 9 - Crop insurance proceeds
  grossProceedsAttorney: number | null // Box 10 - Gross proceeds paid to attorney
  fishPurchased: number | null // Box 11 - Fish purchased for resale
  section409ADeferrals: number | null // Box 12 - Section 409A deferrals
  excessGoldenParachute: number | null // Box 13 - Excess golden parachute payments
  nonqualifiedDeferredComp: number | null // Box 14 - Nonqualified deferred compensation

  // State Tax Information (Boxes 15-18)
  stateTaxInfo: Array<{
    state: string | null
    stateId: string | null
    stateIncome: number | null
  }>

  // Metadata
  taxYear: number | null
  corrected: boolean
  fatcaFilingRequirement: boolean
}

/**
 * Generate 1099-MISC OCR extraction prompt
 */
export function get1099MiscExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from IRS Form 1099-MISC (Miscellaneous Information).

IMPORTANT: This form reports various types of income including rents, royalties, prizes, and other income.
Note: Nonemployee compensation (freelance income) moved to Form 1099-NEC starting 2020.

Extract the following fields:

PAYER INFORMATION:
- payerName, payerAddress, payerTIN, payerPhone

RECIPIENT INFORMATION:
- recipientName, recipientAddress, recipientTIN, accountNumber

INCOME TYPES:
- rents: Box 1 - Rental income (landlord receiving rent)
- royalties: Box 2 - Royalties (oil, gas, patents, copyrights)
- otherIncome: Box 3 - Other income (prizes, awards, taxable damages)
- federalIncomeTaxWithheld: Box 4 - Federal income tax withheld
- fishingBoatProceeds: Box 5 - Fishing boat proceeds
- medicalPayments: Box 6 - Medical and health care payments
- payerMadeDirectSales: Box 7 - Direct sales of $5,000+ checkbox
- substitutePayments: Box 8 - Substitute payments in lieu of dividends
- cropInsuranceProceeds: Box 9 - Crop insurance proceeds
- grossProceedsAttorney: Box 10 - Gross proceeds paid to attorney
- fishPurchased: Box 11 - Fish purchased for resale
- section409ADeferrals: Box 12 - Section 409A deferrals
- excessGoldenParachute: Box 13 - Excess golden parachute payments
- nonqualifiedDeferredComp: Box 14 - Nonqualified deferred compensation

STATE TAX (Boxes 15-18):
- stateTaxInfo: Array of { state, stateId, stateIncome }

METADATA:
- taxYear, corrected, fatcaFilingRequirement

Respond in JSON format:
{
  "payerName": "ABC Property Management",
  "payerAddress": "100 Business Blvd, City, ST 12345",
  "payerTIN": "XX-XXXXXXX",
  "payerPhone": "(555) 123-4567",
  "recipientName": "JOHN LANDLORD",
  "recipientAddress": "123 Main St, City, ST 12345",
  "recipientTIN": "XXX-XX-XXXX",
  "accountNumber": null,
  "rents": 24000.00,
  "royalties": null,
  "otherIncome": null,
  "federalIncomeTaxWithheld": null,
  "fishingBoatProceeds": null,
  "medicalPayments": null,
  "payerMadeDirectSales": false,
  "substitutePayments": null,
  "cropInsuranceProceeds": null,
  "grossProceedsAttorney": null,
  "fishPurchased": null,
  "section409ADeferrals": null,
  "excessGoldenParachute": null,
  "nonqualifiedDeferredComp": null,
  "stateTaxInfo": [],
  "taxYear": 2024,
  "corrected": false,
  "fatcaFilingRequirement": false
}

Rules:
1. Most common use: Box 1 (rents) for landlords, Box 2 (royalties)
2. Box 3 "Other income" can include prizes, awards, punitive damages
3. Do NOT confuse with 1099-NEC (nonemployee compensation is NOT on 1099-MISC since 2020)
4. All monetary values as numbers without $ or commas
5. Use null for empty fields, NEVER guess`
}

/**
 * Validate 1099-MISC extracted data
 */
export function validate1099MiscData(data: unknown): data is Form1099MiscExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required structure exists
  const requiredFields = ['payerName', 'recipientTIN']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate arrays
  if (!Array.isArray(d.stateTaxInfo)) return false

  // Validate boolean fields
  if (typeof d.corrected !== 'boolean') return false
  if (typeof d.fatcaFilingRequirement !== 'boolean') return false
  if (typeof d.payerMadeDirectSales !== 'boolean') return false

  return true
}

/**
 * Vietnamese field labels for 1099-MISC
 */
export const FORM_1099_MISC_FIELD_LABELS_VI: Record<string, string> = {
  payerName: 'Tên Người trả',
  payerAddress: 'Địa chỉ Người trả',
  payerTIN: 'EIN Người trả',
  payerPhone: 'Điện thoại',
  recipientName: 'Tên Người nhận',
  recipientAddress: 'Địa chỉ Người nhận',
  recipientTIN: 'SSN Người nhận',
  accountNumber: 'Số tài khoản',
  rents: 'Thu nhập cho thuê (Box 1)',
  royalties: 'Tiền bản quyền (Box 2)',
  otherIncome: 'Thu nhập khác (Box 3)',
  federalIncomeTaxWithheld: 'Thuế Liên bang đã khấu trừ (Box 4)',
  fishingBoatProceeds: 'Thu nhập đánh cá (Box 5)',
  medicalPayments: 'Thanh toán y tế (Box 6)',
  payerMadeDirectSales: 'Bán hàng trực tiếp $5,000+ (Box 7)',
  substitutePayments: 'Thanh toán thay thế (Box 8)',
  cropInsuranceProceeds: 'Bảo hiểm nông nghiệp (Box 9)',
  grossProceedsAttorney: 'Phí luật sư (Box 10)',
  fishPurchased: 'Cá mua để bán lại (Box 11)',
  section409ADeferrals: 'Hoãn Section 409A (Box 12)',
  excessGoldenParachute: 'Dù vàng vượt mức (Box 13)',
  nonqualifiedDeferredComp: 'Bồi thường hoãn lại (Box 14)',
  taxYear: 'Năm thuế',
  corrected: 'Đã sửa',
  fatcaFilingRequirement: 'Yêu cầu FATCA',
}
