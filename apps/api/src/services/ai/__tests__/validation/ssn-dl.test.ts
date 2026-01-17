/**
 * Validation Tests: SSN Card, Driver License
 * Identity document validation
 */
import { describe, it, expect } from 'vitest'
import { validateSsnCardData, validateDriverLicenseData } from '../../prompts/ocr/ssn-dl'

// =============================================================================
// SSN CARD VALIDATION TESTS
// =============================================================================
describe('validateSsnCardData', () => {
  it('returns true for valid SSN card data', () => {
    const validData = {
      fullName: 'JOHN DOE',
      firstName: 'JOHN',
      middleName: null,
      lastName: 'DOE',
      ssn: '123-45-6789',
      cardType: 'REGULAR',
      issuedBy: 'SOCIAL SECURITY',
    }

    expect(validateSsnCardData(validData)).toBe(true)
  })

  it('returns false for missing fullName', () => {
    const invalidData = {
      ssn: '123-45-6789',
    }

    expect(validateSsnCardData(invalidData)).toBe(false)
  })

  it('returns false for missing ssn field', () => {
    const invalidData = {
      fullName: 'JOHN DOE',
    }

    expect(validateSsnCardData(invalidData)).toBe(false)
  })

  it('returns false for invalid SSN format', () => {
    const invalidData = {
      fullName: 'JOHN DOE',
      ssn: '123456789', // Missing dashes
    }

    expect(validateSsnCardData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validateSsnCardData(null)).toBe(false)
  })
})

// =============================================================================
// DRIVER LICENSE VALIDATION TESTS
// =============================================================================
describe('validateDriverLicenseData', () => {
  it('returns true for valid driver license data', () => {
    const validData = {
      fullName: 'JOHN DOE',
      firstName: 'JOHN',
      middleName: null,
      lastName: 'DOE',
      licenseNumber: 'D1234567',
      dateOfBirth: '01/15/1980',
      expirationDate: '01/15/2028',
      address: '123 Main St',
      city: 'City',
      state: 'CA',
      zipCode: '12345',
      licenseClass: 'C',
      sex: 'M',
      height: '5-10',
      eyeColor: 'BRN',
      issuedDate: '01/15/2024',
      issuingState: 'CA',
    }

    expect(validateDriverLicenseData(validData)).toBe(true)
  })

  it('returns false for missing licenseNumber', () => {
    const invalidData = {
      fullName: 'JOHN DOE',
      expirationDate: '01/15/2028',
      issuingState: 'CA',
    }

    expect(validateDriverLicenseData(invalidData)).toBe(false)
  })

  it('returns false for missing expirationDate', () => {
    const invalidData = {
      fullName: 'JOHN DOE',
      licenseNumber: 'D1234567',
      issuingState: 'CA',
    }

    expect(validateDriverLicenseData(invalidData)).toBe(false)
  })

  it('returns false for missing issuingState', () => {
    const invalidData = {
      fullName: 'JOHN DOE',
      licenseNumber: 'D1234567',
      expirationDate: '01/15/2028',
    }

    expect(validateDriverLicenseData(invalidData)).toBe(false)
  })

  it('returns false for null input', () => {
    expect(validateDriverLicenseData(null)).toBe(false)
  })
})
