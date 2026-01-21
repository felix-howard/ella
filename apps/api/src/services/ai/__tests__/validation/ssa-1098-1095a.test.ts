/**
 * Validation Tests: SSA-1099, 1098, 1095-A
 * Social security and mortgage/health insurance forms
 */
import { describe, it, expect } from 'vitest'
import { validateSsa1099Data } from '../../prompts/ocr/1099-ssa'
import { validate1098Data } from '../../prompts/ocr/1098'
import { validate1095AData } from '../../prompts/ocr/1095-a'

// =============================================================================
// SSA-1099 VALIDATION TESTS
// =============================================================================
describe('validateSsa1099Data', () => {
  it('returns true for valid SSA-1099 data', () => {
    const validData = {
      beneficiaryName: 'JOHN DOE',
      beneficiaryAddress: '123 Main St, City, ST 12345',
      beneficiarySSN: '123-45-6789',
      claimNumber: '123-45-6789-A',
      totalBenefitsPaid: 18000.0,
      benefitsRepaid: 0,
      netBenefits: 18000.0,
      voluntaryTaxWithheld: 1800.0,
      descriptionOfBenefits: 'RETIREMENT BENEFITS',
      medicarePremiums: 1980.0,
      taxYear: 2024,
      formType: 'SSA-1099',
    }

    expect(validateSsa1099Data(validData)).toBe(true)
  })

  it('returns false for missing beneficiarySSN', () => {
    const invalidData = {
      beneficiaryName: 'JOHN DOE',
      netBenefits: 18000,
    }

    expect(validateSsa1099Data(invalidData)).toBe(false)
  })

  it('returns false for invalid formType', () => {
    const invalidData = {
      beneficiaryName: 'JOHN DOE',
      beneficiarySSN: '123-45-6789',
      netBenefits: 18000,
      formType: 'INVALID',
    }

    expect(validateSsa1099Data(invalidData)).toBe(false)
  })

  it('returns true for valid RRB-1099 formType', () => {
    const validData = {
      beneficiaryName: 'JOHN DOE',
      beneficiarySSN: '123-45-6789',
      netBenefits: 18000,
      formType: 'RRB-1099',
    }

    expect(validateSsa1099Data(validData)).toBe(true)
  })

  it('returns false for null input', () => {
    expect(validateSsa1099Data(null)).toBe(false)
  })
})

// =============================================================================
// 1098 VALIDATION TESTS
// =============================================================================
describe('validate1098Data', () => {
  it('returns true for valid 1098 data', () => {
    const validData = {
      recipientName: 'ABC Mortgage Company',
      recipientAddress: '500 Bank St, City, ST 12345',
      recipientTIN: '12-3456789',
      payerName: 'JOHN DOE',
      payerAddress: '123 Main St, City, ST 12345',
      payerTIN: '123-45-6789',
      accountNumber: '1234567890',
      mortgageInterestReceived: 12500.0,
      outstandingMortgagePrincipal: 350000.0,
      mortgageOriginationDate: '03/15/2020',
      mortgageInsurancePremiums: 1200.0,
      numberOfProperties: 1,
      propertyTax: 4500.0,
      taxYear: 2024,
      corrected: false,
    }

    expect(validate1098Data(validData)).toBe(true)
  })

  it('returns false for missing mortgageInterestReceived', () => {
    const invalidData = {
      recipientName: 'ABC Mortgage',
      payerTIN: '123-45-6789',
      corrected: false,
    }

    expect(validate1098Data(invalidData)).toBe(false)
  })

  it('returns false for non-boolean corrected', () => {
    const invalidData = {
      recipientName: 'ABC Mortgage',
      payerTIN: '123-45-6789',
      mortgageInterestReceived: 12500,
      corrected: 'false',
    }

    expect(validate1098Data(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1098Data(null)).toBe(false)
  })
})

// =============================================================================
// 1095-A VALIDATION TESTS
// =============================================================================
describe('validate1095AData', () => {
  it('returns true for valid 1095-A data', () => {
    const validData = {
      marketplaceName: 'HealthCare.gov',
      marketplaceId: 'FF',
      policyNumber: '12345678',
      policyStartDate: '01/01/2024',
      policyEndDate: '12/31/2024',
      recipientName: 'JOHN DOE',
      recipientSSN: '123-45-6789',
      recipientAddress: '123 Main St, City, ST 12345',
      recipientDOB: '01/15/1980',
      spouseName: 'JANE DOE',
      spouseSSN: '123-45-6790',
      spouseDOB: '03/20/1982',
      coveredIndividuals: [
        { name: 'JOHN DOE', ssn: '123-45-6789', dob: '01/15/1980', coverageStartDate: '01/01/2024', coverageEndDate: '12/31/2024' },
      ],
      monthlyData: [
        { month: 'January', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
      ],
      annualEnrollmentPremium: 9600.0,
      annualSlcsp: 10800.0,
      annualAdvancePayment: 6000.0,
      taxYear: 2024,
      corrected: false,
    }

    expect(validate1095AData(validData)).toBe(true)
  })

  it('returns false for missing policyNumber', () => {
    const invalidData = {
      recipientName: 'JOHN DOE',
      recipientSSN: '123-45-6789',
      monthlyData: [],
      coveredIndividuals: [],
      corrected: false,
    }

    expect(validate1095AData(invalidData)).toBe(false)
  })

  it('returns false for non-array monthlyData', () => {
    const invalidData = {
      recipientName: 'JOHN DOE',
      recipientSSN: '123-45-6789',
      policyNumber: '12345678',
      monthlyData: 'not an array',
      coveredIndividuals: [],
      corrected: false,
    }

    expect(validate1095AData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validate1095AData(null)).toBe(false)
  })
})
