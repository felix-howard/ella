/**
 * OCR Prompts Validation Unit Tests
 * Tests validation functions for all OCR prompt types
 */
import { describe, it, expect } from 'vitest'
import { validate1098TData } from '../prompts/ocr/1098-t'
import { validate1099GData } from '../prompts/ocr/1099-g'
import { validate1099MiscData } from '../prompts/ocr/1099-misc'

describe('validate1098TData', () => {
  it('returns true for valid 1098-T data with all required fields', () => {
    const validData = {
      filerName: 'State University',
      filerAddress: '123 Campus Dr',
      filerTIN: '12-3456789',
      filerPhone: '555-123-4567',
      studentName: 'John Student',
      studentAddress: '456 Dorm St',
      studentTIN: '123-45-6789',
      accountNumber: '12345678',
      paymentsReceived: 15000.0,
      amountsBilled: null,
      adjustmentsPriorYear: null,
      scholarshipsGrants: 5000.0,
      adjustmentsScholarships: null,
      includesJanMarch: false,
      halfTimeStudent: true,
      graduateStudent: false,
      insuranceContractReimbursement: null,
      taxYear: 2024,
      corrected: false,
    }

    expect(validate1098TData(validData)).toBe(true)
  })

  it('returns false for missing filerName', () => {
    const invalidData = {
      studentName: 'John Student',
      studentTIN: '123-45-6789',
      corrected: false,
      halfTimeStudent: true,
      graduateStudent: false,
      includesJanMarch: false,
    }

    expect(validate1098TData(invalidData)).toBe(false)
  })

  it('returns false for missing studentTIN', () => {
    const invalidData = {
      filerName: 'State University',
      studentName: 'John Student',
      corrected: false,
      halfTimeStudent: true,
      graduateStudent: false,
      includesJanMarch: false,
    }

    expect(validate1098TData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean corrected field', () => {
    const invalidData = {
      filerName: 'State University',
      studentName: 'John Student',
      studentTIN: '123-45-6789',
      corrected: 'no',
      halfTimeStudent: true,
      graduateStudent: false,
      includesJanMarch: false,
    }

    expect(validate1098TData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean halfTimeStudent field', () => {
    const invalidData = {
      filerName: 'State University',
      studentName: 'John Student',
      studentTIN: '123-45-6789',
      corrected: false,
      halfTimeStudent: 'yes',
      graduateStudent: false,
      includesJanMarch: false,
    }

    expect(validate1098TData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1098TData(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validate1098TData('string')).toBe(false)
    expect(validate1098TData(123)).toBe(false)
    expect(validate1098TData(undefined)).toBe(false)
  })
})

describe('validate1099GData', () => {
  it('returns true for valid 1099-G data with all required fields', () => {
    const validData = {
      payerName: 'State Unemployment Agency',
      payerAddress: '100 Gov Center',
      payerTIN: '12-3456789',
      payerPhone: '555-123-4567',
      recipientName: 'John Doe',
      recipientAddress: '123 Main St',
      recipientTIN: '123-45-6789',
      accountNumber: 'UI-123456789',
      unemploymentCompensation: 15000.0,
      stateTaxRefund: null,
      taxRefundYear: null,
      federalIncomeTaxWithheld: 1500.0,
      rtaaPayments: null,
      taxableGrants: null,
      agriculturePayments: null,
      marketGain: false,
      stateTaxInfo: [{ state: 'CA', stateId: 'XXX-XXXX', stateTaxWithheld: 750.0 }],
      taxYear: 2024,
      corrected: false,
    }

    expect(validate1099GData(validData)).toBe(true)
  })

  it('returns true for valid data with empty stateTaxInfo array', () => {
    const validData = {
      payerName: 'State Agency',
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      marketGain: false,
      corrected: false,
    }

    expect(validate1099GData(validData)).toBe(true)
  })

  it('returns false for missing payerName', () => {
    const invalidData = {
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      marketGain: false,
      corrected: false,
    }

    expect(validate1099GData(invalidData)).toBe(false)
  })

  it('returns false for missing recipientTIN', () => {
    const invalidData = {
      payerName: 'State Agency',
      stateTaxInfo: [],
      marketGain: false,
      corrected: false,
    }

    expect(validate1099GData(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      payerName: 'State Agency',
      recipientTIN: '123-45-6789',
      stateTaxInfo: 'not an array',
      marketGain: false,
      corrected: false,
    }

    expect(validate1099GData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean marketGain', () => {
    const invalidData = {
      payerName: 'State Agency',
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      marketGain: 'false',
      corrected: false,
    }

    expect(validate1099GData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099GData(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validate1099GData('string')).toBe(false)
    expect(validate1099GData(123)).toBe(false)
  })
})

describe('validate1099MiscData', () => {
  it('returns true for valid 1099-MISC data with rental income', () => {
    const validData = {
      payerName: 'ABC Property Management',
      payerAddress: '100 Business Blvd',
      payerTIN: '12-3456789',
      payerPhone: '555-123-4567',
      recipientName: 'John Landlord',
      recipientAddress: '123 Main St',
      recipientTIN: '123-45-6789',
      accountNumber: null,
      rents: 24000.0,
      royalties: null,
      otherIncome: null,
      federalIncomeTaxWithheld: null,
      fishingBoatProceeds: null,
      medicalPayments: null,
      payerMadeDirectSales: false,
      substitutePayments: null,
      cropInsuranceProceeds: null,
      grossProceedsAttorney: null,
      fishPurchased: null,
      section409ADeferrals: null,
      excessGoldenParachute: null,
      nonqualifiedDeferredComp: null,
      stateTaxInfo: [],
      taxYear: 2024,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(validData)).toBe(true)
  })

  it('returns true for valid data with royalties', () => {
    const validData = {
      payerName: 'Publishing Co',
      recipientTIN: '123-45-6789',
      royalties: 5000.0,
      stateTaxInfo: [],
      payerMadeDirectSales: false,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(validData)).toBe(true)
  })

  it('returns false for missing payerName', () => {
    const invalidData = {
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      payerMadeDirectSales: false,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(invalidData)).toBe(false)
  })

  it('returns false for missing recipientTIN', () => {
    const invalidData = {
      payerName: 'ABC Property',
      stateTaxInfo: [],
      payerMadeDirectSales: false,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      payerName: 'ABC Property',
      recipientTIN: '123-45-6789',
      stateTaxInfo: { state: 'CA' },
      payerMadeDirectSales: false,
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean payerMadeDirectSales', () => {
    const invalidData = {
      payerName: 'ABC Property',
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      payerMadeDirectSales: 'yes',
      corrected: false,
      fatcaFilingRequirement: false,
    }

    expect(validate1099MiscData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean fatcaFilingRequirement', () => {
    const invalidData = {
      payerName: 'ABC Property',
      recipientTIN: '123-45-6789',
      stateTaxInfo: [],
      payerMadeDirectSales: false,
      corrected: false,
      fatcaFilingRequirement: 'no',
    }

    expect(validate1099MiscData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099MiscData(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validate1099MiscData('string')).toBe(false)
    expect(validate1099MiscData(123)).toBe(false)
    expect(validate1099MiscData(undefined)).toBe(false)
  })
})
