/**
 * K-1 Variants + Health/Education Unit Tests (Phase 4)
 * Tests for 8 OCR extraction prompts
 * Covers: K1-1065, K1-1120S, K1-1041, 1095-B, 1095-C, 5498-SA, 1098-E, 8332
 */
import { describe, it, expect } from 'vitest'

import { getK1_1065ExtractionPrompt, validateK1_1065Data, SCHEDULE_K1_1065_FIELD_LABELS_VI } from '../k1-1065'
import { getK1_1120SExtractionPrompt, validateK1_1120SData, SCHEDULE_K1_1120S_FIELD_LABELS_VI } from '../k1-1120s'
import { getK1_1041ExtractionPrompt, validateK1_1041Data, SCHEDULE_K1_1041_FIELD_LABELS_VI } from '../k1-1041'
import { get1095BExtractionPrompt, validate1095BData, FORM_1095_B_FIELD_LABELS_VI } from '../1095-b'
import { get1095CExtractionPrompt, validate1095CData, FORM_1095_C_FIELD_LABELS_VI } from '../1095-c'
import { get5498SAExtractionPrompt, validate5498SAData, FORM_5498_SA_FIELD_LABELS_VI } from '../5498-sa'
import { get1098EExtractionPrompt, validate1098EData, FORM_1098_E_FIELD_LABELS_VI } from '../1098-e'
import { get8332ExtractionPrompt, validate8332Data, FORM_8332_FIELD_LABELS_VI } from '../8332'

const forms = [
  {
    name: 'K1-1065 (Partnership)',
    prompt: getK1_1065ExtractionPrompt,
    validate: validateK1_1065Data,
    labels: SCHEDULE_K1_1065_FIELD_LABELS_VI,
    validData: {
      partnershipName: 'ABC Partners LLC', partnershipEIN: 'XX-XXXXXXX',
      partnerName: 'John Doe', partnerSSN: 'XXX-XX-XXXX',
      finalK1: false, amendedK1: false,
      ordinaryBusinessIncome: 45000, guaranteedPayments: null,
      netRentalRealEstateIncome: null, interestIncome: null,
      dividendIncome: null, shortTermCapitalGain: null,
      longTermCapitalGain: null, section179Deduction: null,
      selfEmploymentEarnings: 45000, taxYear: 2024,
    },
    requiredFields: ['partnershipName', 'partnershipEIN', 'partnerName', 'partnerSSN'],
    booleanFields: ['finalK1', 'amendedK1'],
  },
  {
    name: 'K1-1120S (S-Corp)',
    prompt: getK1_1120SExtractionPrompt,
    validate: validateK1_1120SData,
    labels: SCHEDULE_K1_1120S_FIELD_LABELS_VI,
    validData: {
      corporationName: 'XYZ Corp Inc', corporationEIN: 'XX-XXXXXXX',
      shareholderName: 'John Doe', shareholderSSN: 'XXX-XX-XXXX',
      finalK1: false, amendedK1: false,
      ordinaryBusinessIncome: 80000, netRentalRealEstateIncome: null,
      interestIncome: null, dividendIncome: null,
      shortTermCapitalGain: null, longTermCapitalGain: null,
      section179Deduction: null, taxYear: 2024,
    },
    requiredFields: ['corporationName', 'corporationEIN', 'shareholderName', 'shareholderSSN'],
    booleanFields: ['finalK1', 'amendedK1'],
  },
  {
    name: 'K1-1041 (Trust/Estate)',
    prompt: getK1_1041ExtractionPrompt,
    validate: validateK1_1041Data,
    labels: SCHEDULE_K1_1041_FIELD_LABELS_VI,
    validData: {
      estateTrustName: 'Smith Family Trust', estateTrustEIN: 'XX-XXXXXXX',
      beneficiaryName: 'John Smith', beneficiarySSN: 'XXX-XX-XXXX',
      finalK1: false, amendedK1: false, requiredDistribution: true,
      interestIncome: 5000, dividendIncome: null,
      netShortTermCapitalGain: null, netLongTermCapitalGain: null,
      otherPortfolioIncome: null, taxYear: 2024,
    },
    requiredFields: ['estateTrustName', 'estateTrustEIN', 'beneficiaryName', 'beneficiarySSN'],
    booleanFields: ['finalK1', 'amendedK1', 'requiredDistribution'],
  },
  {
    name: '1095-B',
    prompt: get1095BExtractionPrompt,
    validate: validate1095BData,
    labels: FORM_1095_B_FIELD_LABELS_VI,
    validData: {
      responsibleName: 'JOHN DOE', responsibleSSN: 'XXX-XX-XXXX',
      issuerName: 'Blue Cross', issuerEIN: null,
      coveredIndividuals: [], corrected: false, taxYear: 2024,
    },
    requiredFields: ['responsibleName', 'responsibleSSN', 'issuerName'],
    booleanFields: ['corrected'],
    arrayFields: ['coveredIndividuals'],
  },
  {
    name: '1095-C',
    prompt: get1095CExtractionPrompt,
    validate: validate1095CData,
    labels: FORM_1095_C_FIELD_LABELS_VI,
    validData: {
      employerName: 'ABC Corporation', employerEIN: 'XX-XXXXXXX',
      employeeName: 'JOHN DOE', employeeSSN: 'XXX-XX-XXXX',
      monthlyData: [], coveredIndividuals: [], corrected: false, taxYear: 2024,
    },
    requiredFields: ['employerName', 'employerEIN', 'employeeName', 'employeeSSN'],
    booleanFields: ['corrected'],
    arrayFields: ['monthlyData', 'coveredIndividuals'],
  },
  {
    name: '5498-SA',
    prompt: get5498SAExtractionPrompt,
    validate: validate5498SAData,
    labels: FORM_5498_SA_FIELD_LABELS_VI,
    validData: {
      trusteeName: 'Fidelity Investments', participantName: 'JOHN DOE',
      participantSSN: 'XXX-XX-XXXX', accountType: 'HSA',
      fairMarketValue: 12500, employerContributions: 1500,
      employeeContributions: 5800, totalContributions: null,
      corrected: false, taxYear: 2024,
    },
    requiredFields: ['trusteeName', 'participantName', 'participantSSN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1098-E',
    prompt: get1098EExtractionPrompt,
    validate: validate1098EData,
    labels: FORM_1098_E_FIELD_LABELS_VI,
    validData: {
      lenderName: 'Navient Solutions', lenderAddress: null, lenderTIN: null,
      borrowerName: 'JOHN DOE', borrowerAddress: null, borrowerSSN: 'XXX-XX-XXXX',
      studentLoanInterestPaid: 2500, isQualifiedLoan: true,
      corrected: false, taxYear: 2024,
    },
    requiredFields: ['lenderName', 'borrowerName', 'borrowerSSN'],
    booleanFields: ['corrected', 'isQualifiedLoan'],
  },
  {
    name: '8332',
    prompt: get8332ExtractionPrompt,
    validate: validate8332Data,
    labels: FORM_8332_FIELD_LABELS_VI,
    validData: {
      childName: 'JANE DOE JR', custodialParentName: 'JANE DOE',
      noncustodialParentName: 'JOHN DOE', releaseAllFutureYears: false,
      signedByCustodialParent: true, releaseYears: null,
      releaseType: 'CURRENT_YEAR', taxYear: 2024,
    },
    requiredFields: ['childName', 'custodialParentName', 'noncustodialParentName'],
    booleanFields: ['releaseAllFutureYears', 'signedByCustodialParent'],
  },
]

// Prompt Generation
describe('K1/Health/Education - Prompt Generation', () => {
  forms.forEach(({ name, prompt }) => {
    it(`${name}: returns non-empty string with JSON and rules`, () => {
      const result = prompt()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(100)
      expect(result).toContain('JSON')
      expect(result).toContain('Rules')
    })
  })
})

// Validation - Reject invalid inputs
describe('K1/Health/Education - Validation Rejects Invalid', () => {
  forms.forEach(({ name, validate }) => {
    it(`${name}: rejects null, undefined, non-object`, () => {
      expect(validate(null)).toBe(false)
      expect(validate(undefined)).toBe(false)
      expect(validate('string')).toBe(false)
      expect(validate(123)).toBe(false)
      expect(validate([])).toBe(false)
    })

    it(`${name}: rejects empty object`, () => {
      expect(validate({})).toBe(false)
    })
  })
})

// Validation - Accept valid data
describe('K1/Health/Education - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - Reject missing required fields
describe('K1/Health/Education - Validation Rejects Missing Required Fields', () => {
  forms.forEach(({ name, validate, validData, requiredFields }) => {
    requiredFields.forEach((field) => {
      it(`${name}: rejects data missing '${field}'`, () => {
        const partial = { ...validData }
        delete (partial as Record<string, unknown>)[field]
        expect(validate(partial)).toBe(false)
      })
    })
  })
})

// Validation - Reject wrong boolean types
describe('K1/Health/Education - Validation Rejects Wrong Boolean Types', () => {
  forms.forEach(({ name, validate, validData, booleanFields }) => {
    booleanFields.forEach((field) => {
      it(`${name}: rejects non-boolean '${field}'`, () => {
        const bad = { ...validData, [field]: 'not-a-boolean' }
        expect(validate(bad)).toBe(false)
      })
    })
  })
})

// Validation - Reject non-array fields
describe('K1/Health/Education - Validation Rejects Missing Arrays', () => {
  forms
    .filter((f) => f.arrayFields && f.arrayFields.length > 0)
    .forEach(({ name, validate, validData, arrayFields }) => {
      arrayFields!.forEach((field) => {
        it(`${name}: rejects non-array '${field}'`, () => {
          const bad = { ...validData, [field]: 'not-an-array' }
          expect(validate(bad)).toBe(false)
        })
      })
    })
})

// Vietnamese Labels
describe('K1/Health/Education - Vietnamese Labels', () => {
  forms.forEach(({ name, labels }) => {
    it(`${name}: has non-empty Vietnamese labels`, () => {
      const keys = Object.keys(labels)
      expect(keys.length).toBeGreaterThan(0)
      for (const [key, value] of Object.entries(labels)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
        expect(value).not.toBe(key)
      }
    })
  })
})
