/**
 * Validation Tests: W2, 1099-K, Schedule K-1
 * Core income tax forms validation
 */
import { describe, it, expect } from 'vitest'
import { validateW2Data } from '../../prompts/ocr/w2'
import { validate1099KData } from '../../prompts/ocr/1099-k'
import { validateScheduleK1Data } from '../../prompts/ocr/k-1'

// =============================================================================
// W2 VALIDATION TESTS
// =============================================================================
describe('validateW2Data', () => {
  it('returns true for valid W2 data with all required fields', () => {
    const validData = {
      employerEIN: '12-3456789',
      employerName: 'Acme Corporation',
      employerAddress: '123 Business Blvd, City, ST 12345',
      controlNumber: null,
      employeeSSN: '123-45-6789',
      employeeName: 'NGUYEN VAN A',
      employeeAddress: '456 Home St, City, ST 67890',
      wagesTipsOther: 52000.0,
      federalIncomeTaxWithheld: 7800.0,
      socialSecurityWages: 52000.0,
      socialSecurityTaxWithheld: 3224.0,
      medicareWages: 52000.0,
      medicareTaxWithheld: 754.0,
      socialSecurityTips: null,
      allocatedTips: null,
      dependentCareBenefits: null,
      nonQualifiedPlans: null,
      stateTaxInfo: [
        { state: 'CA', stateId: '12-3456789', stateWages: 52000.0, stateTaxWithheld: 2600.0 },
      ],
      localTaxInfo: [],
      box12Codes: [{ code: 'D', amount: 5000.0 }],
      box13Flags: { statutoryEmployee: false, retirementPlan: true, thirdPartySickPay: false },
      box14Other: null,
      taxYear: 2024,
      formVariant: 'W-2',
    }

    expect(validateW2Data(validData)).toBe(true)
  })

  it('returns false for missing required field employerEIN', () => {
    const invalidData = {
      employerName: 'Acme Corp',
      employeeSSN: '123-45-6789',
      employeeName: 'John Doe',
      wagesTipsOther: 50000,
      federalIncomeTaxWithheld: 5000,
      stateTaxInfo: [],
      localTaxInfo: [],
      box12Codes: [],
      box13Flags: { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false },
    }

    expect(validateW2Data(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      employeeSSN: '123-45-6789',
      employeeName: 'John Doe',
      wagesTipsOther: 50000,
      federalIncomeTaxWithheld: 5000,
      stateTaxInfo: 'not an array',
      localTaxInfo: [],
      box12Codes: [],
      box13Flags: { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false },
    }

    expect(validateW2Data(invalidData)).toBe(false)
  })

  it('returns false for missing box13Flags', () => {
    const invalidData = {
      employerEIN: '12-3456789',
      employerName: 'Acme Corp',
      employeeSSN: '123-45-6789',
      employeeName: 'John Doe',
      wagesTipsOther: 50000,
      federalIncomeTaxWithheld: 5000,
      stateTaxInfo: [],
      localTaxInfo: [],
      box12Codes: [],
    }

    expect(validateW2Data(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validateW2Data(null)).toBe(false)
  })

  it('returns false for non-object input', () => {
    expect(validateW2Data('string')).toBe(false)
    expect(validateW2Data(123)).toBe(false)
    expect(validateW2Data(undefined)).toBe(false)
  })
})

// =============================================================================
// 1099-K VALIDATION TESTS
// =============================================================================
describe('validate1099KData', () => {
  it('returns true for valid 1099-K data with all required fields', () => {
    const validData = {
      filerName: 'Square Inc',
      filerAddress: '1455 Market St, San Francisco, CA 94103',
      filerTIN: '12-3456789',
      filerPhone: null,
      payeeName: 'ABC Nail Salon LLC',
      payeeAddress: '123 Main St, City, ST 12345',
      payeeTIN: '12-3456789',
      accountNumber: 'XXXX-XXXX-1234',
      grossAmount: 85000.0,
      cardNotPresent: null,
      numberOfPaymentTransactions: 2500,
      federalIncomeTaxWithheld: null,
      monthlyAmounts: {
        january: 7000,
        february: 7000,
        march: 7000,
        april: 7000,
        may: 7000,
        june: 7000,
        july: 7000,
        august: 7000,
        september: 7000,
        october: 7000,
        november: 7500,
        december: 7500,
      },
      stateTaxInfo: [{ state: 'CA', stateId: 'XXX-XXXX-X', stateGrossAmount: 85000.0 }],
      pseName: 'Square Inc',
      psePhone: '1-855-700-6000',
      transactionReportingType: 'PAYMENT_CARD',
      corrected: false,
      taxYear: 2024,
    }

    expect(validate1099KData(validData)).toBe(true)
  })

  it('returns false for missing grossAmount field', () => {
    const invalidData = {
      filerName: 'Square Inc',
      payeeName: 'ABC Salon',
      payeeTIN: '12-3456789',
      stateTaxInfo: [],
      monthlyAmounts: {},
      corrected: false,
    }

    expect(validate1099KData(invalidData)).toBe(false)
  })

  it('returns false for non-array stateTaxInfo', () => {
    const invalidData = {
      filerName: 'Square Inc',
      payeeName: 'ABC Salon',
      payeeTIN: '12-3456789',
      grossAmount: 85000,
      stateTaxInfo: 'not an array',
      monthlyAmounts: {},
      corrected: false,
    }

    expect(validate1099KData(invalidData)).toBe(false)
  })

  it('returns false for non-boolean corrected field', () => {
    const invalidData = {
      filerName: 'Square Inc',
      payeeName: 'ABC Salon',
      payeeTIN: '12-3456789',
      grossAmount: 85000,
      stateTaxInfo: [],
      monthlyAmounts: {},
      corrected: 'false',
    }

    expect(validate1099KData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1099KData(null)).toBe(false)
  })
})

// =============================================================================
// SCHEDULE K-1 VALIDATION TESTS
// =============================================================================
describe('validateScheduleK1Data', () => {
  it('returns true for valid K-1 data with all required fields', () => {
    const validData = {
      partnershipName: 'ABC Partners LLC',
      partnershipAddress: '123 Business Blvd, City, ST 12345',
      partnershipEIN: '12-3456789',
      irsCenter: 'Ogden, UT',
      partnerName: 'John Partner',
      partnerAddress: '456 Main St, City, ST 67890',
      partnerSSN: '123-45-6789',
      generalPartner: false,
      limitedPartner: true,
      domesticPartner: true,
      foreignPartner: false,
      profitShareBeginning: 25.0,
      profitShareEnding: 25.0,
      lossShareBeginning: 25.0,
      lossShareEnding: 25.0,
      capitalShareBeginning: 25.0,
      capitalShareEnding: 25.0,
      ordinaryBusinessIncome: 50000.0,
      guaranteedPayments: 12000.0,
      selfEmploymentEarnings: 62000.0,
      amended: false,
      formType: 'K-1_1065',
      taxYear: 2024,
    }

    expect(validateScheduleK1Data(validData)).toBe(true)
  })

  it('returns false for missing partnership name', () => {
    const invalidData = {
      partnershipEIN: '12-3456789',
      partnerName: 'John Partner',
      partnerSSN: '123-45-6789',
      generalPartner: false,
      limitedPartner: true,
      domesticPartner: true,
      foreignPartner: false,
      amended: false,
    }

    expect(validateScheduleK1Data(invalidData)).toBe(false)
  })

  it('returns false for non-boolean partner type fields', () => {
    const invalidData = {
      partnershipName: 'ABC Partners LLC',
      partnershipEIN: '12-3456789',
      partnerName: 'John Partner',
      partnerSSN: '123-45-6789',
      generalPartner: 'false', // should be boolean
      limitedPartner: true,
      domesticPartner: true,
      foreignPartner: false,
      amended: false,
    }

    expect(validateScheduleK1Data(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validateScheduleK1Data(null)).toBe(false)
  })
})
