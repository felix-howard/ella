/**
 * IRS Forms Part 2 Unit Tests (Phase 6)
 * Tests for 16 IRS form OCR extraction prompts
 * Covers: 8995-A, W-2G, 2210, 3903, 4684, 4868, 8936, W-9,
 *         6251, 2555, 5329, 8379, 8582, 8880, 8962, 8938
 */
import { describe, it, expect } from 'vitest'

import { getForm8995AExtractionPrompt, validateForm8995AData, FORM_8995A_FIELD_LABELS_VI } from '../form-8995-a'
import { getW2GExtractionPrompt, validateW2GData, W2G_FIELD_LABELS_VI } from '../w2g'
import { getForm2210ExtractionPrompt, validateForm2210Data, FORM_2210_FIELD_LABELS_VI } from '../form-2210'
import { getForm3903ExtractionPrompt, validateForm3903Data, FORM_3903_FIELD_LABELS_VI } from '../form-3903'
import { getForm4684ExtractionPrompt, validateForm4684Data, FORM_4684_FIELD_LABELS_VI } from '../form-4684'
import { getForm4868ExtractionPrompt, validateForm4868Data, FORM_4868_FIELD_LABELS_VI } from '../form-4868'
import { getForm8936ExtractionPrompt, validateForm8936Data, FORM_8936_FIELD_LABELS_VI } from '../form-8936'
import { getFormW9ExtractionPrompt, validateFormW9Data, FORM_W9_FIELD_LABELS_VI } from '../form-w9'
import { getForm6251ExtractionPrompt, validateForm6251Data, FORM_6251_FIELD_LABELS_VI } from '../form-6251'
import { getForm2555ExtractionPrompt, validateForm2555Data, FORM_2555_FIELD_LABELS_VI } from '../form-2555'
import { getForm5329ExtractionPrompt, validateForm5329Data, FORM_5329_FIELD_LABELS_VI } from '../form-5329'
import { getForm8379ExtractionPrompt, validateForm8379Data, FORM_8379_FIELD_LABELS_VI } from '../form-8379'
import { getForm8582ExtractionPrompt, validateForm8582Data, FORM_8582_FIELD_LABELS_VI } from '../form-8582'
import { getForm8880ExtractionPrompt, validateForm8880Data, FORM_8880_FIELD_LABELS_VI } from '../form-8880'
import { getForm8962ExtractionPrompt, validateForm8962Data, FORM_8962_FIELD_LABELS_VI } from '../form-8962'
import { getForm8938ExtractionPrompt, validateForm8938Data, FORM_8938_FIELD_LABELS_VI } from '../form-8938'

const forms = [
  {
    name: 'Form 8995-A',
    prompt: getForm8995AExtractionPrompt,
    validate: validateForm8995AData,
    labels: FORM_8995A_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      businesses: [{ businessName: 'Doe Consulting', businessTIN: null, qualifiedBusinessIncome: 120000, w2WagesPaid: 40000, ubiaOfQualifiedProperty: null, qbiComponent: null }],
      totalQBI: 120000, totalW2Wages: 40000, totalUBIA: null,
      qbiDeductionAmount: 24000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['businesses'],
    criticalNumericFields: ['qbiDeductionAmount'],
  },
  {
    name: 'W-2G',
    prompt: getW2GExtractionPrompt,
    validate: validateW2GData,
    labels: W2G_FIELD_LABELS_VI,
    validData: {
      winnerName: 'JOHN DOE', winnerAddress: null, winnerTIN: null,
      payerName: null, payerTIN: null,
      grossWinnings: 5000, federalIncomeTaxWithheld: 1200,
      typeOfWager: 'Slot Machine', dateWon: null,
      taxYear: 2024,
    },
    requiredFields: ['winnerName'],
    criticalNumericFields: ['grossWinnings'],
  },
  {
    name: 'Form 2210',
    prompt: getForm2210ExtractionPrompt,
    validate: validateForm2210Data,
    labels: FORM_2210_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      totalPenalty: 250, quarterlyPayments: [],
      requestWaiver: null, annualizedIncomeMethod: null,
      taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['totalPenalty'],
  },
  {
    name: 'Form 3903',
    prompt: getForm3903ExtractionPrompt,
    validate: validateForm3903Data,
    labels: FORM_3903_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'SGT JOHN DOE', movingFromAddress: null,
      movingToAddress: null, transportationCost: 3500,
      storageCost: null, deductibleMovingExpenses: 3500,
      militaryMoveOnly: true, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['deductibleMovingExpenses'],
  },
  {
    name: 'Form 4684',
    prompt: getForm4684ExtractionPrompt,
    validate: validateForm4684Data,
    labels: FORM_4684_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      properties: [], businessProperties: [],
      deductibleCasualtyLoss: null, federalDisasterDesignation: true,
      taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['properties', 'businessProperties'],
    criticalNumericFields: ['deductibleCasualtyLoss'],
  },
  {
    name: 'Form 4868',
    prompt: getForm4868ExtractionPrompt,
    validate: validateForm4868Data,
    labels: FORM_4868_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      estimatedTaxLiability: 25000, totalPayments: 23000,
      balanceDue: 2000, amountPaying: 2000,
      outOfCountry: false, combatZone: false,
      taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['amountPaying'],
  },
  {
    name: 'Form 8936',
    prompt: getForm8936ExtractionPrompt,
    validate: validateForm8936Data,
    labels: FORM_8936_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      vehicles: [], cleanVehicleCredit: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['vehicles'],
    criticalNumericFields: ['cleanVehicleCredit'],
  },
  {
    name: 'Form W-9',
    prompt: getFormW9ExtractionPrompt,
    validate: validateFormW9Data,
    labels: FORM_W9_FIELD_LABELS_VI,
    validData: {
      name: 'JOHN DOE', businessName: null, tin: 'XXX-XX-XXXX',
      taxClassification: 'INDIVIDUAL', address: null,
      subjectToBackupWithholding: false, taxYear: null,
    },
    requiredFields: ['name'],
  },
  {
    name: 'Form 6251',
    prompt: getForm6251ExtractionPrompt,
    validate: validateForm6251Data,
    labels: FORM_6251_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      taxableIncome: 250000, alternativeMinimumTaxableIncome: null,
      exemptionAmount: null, alternativeMinimumTax: 8500,
      taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['alternativeMinimumTax'],
  },
  {
    name: 'Form 2555',
    prompt: getForm2555ExtractionPrompt,
    validate: validateForm2555Data,
    labels: FORM_2555_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      foreignCountry: 'Germany', employerIsForeign: true,
      foreignEarnedIncome: 120000, foreignHousingAmount: null,
      totalExclusion: 120000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['totalExclusion'],
  },
  {
    name: 'Form 5329',
    prompt: getForm5329ExtractionPrompt,
    validate: validateForm5329Data,
    labels: FORM_5329_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      earlyDistributionTax: 1000, excessContributionTax: null,
      totalAdditionalTax: 1000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['totalAdditionalTax'],
  },
  {
    name: 'Form 8379',
    prompt: getForm8379ExtractionPrompt,
    validate: validateForm8379Data,
    labels: FORM_8379_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JANE DOE', taxpayerSSN: null,
      filedWithReturn: true, filedAfterOffset: null,
      allocatedRefund: 3500, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['allocatedRefund'],
  },
  {
    name: 'Form 8582',
    prompt: getForm8582ExtractionPrompt,
    validate: validateForm8582Data,
    labels: FORM_8582_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      rentalActivities: [], allowedLosses: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['rentalActivities'],
    criticalNumericFields: ['allowedLosses'],
  },
  {
    name: 'Form 8880',
    prompt: getForm8880ExtractionPrompt,
    validate: validateForm8880Data,
    labels: FORM_8880_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      retirementContributions: 4000, creditRate: 50,
      retirementSavingsCredit: 2000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['retirementSavingsCredit'],
  },
  {
    name: 'Form 8962',
    prompt: getForm8962ExtractionPrompt,
    validate: validateForm8962Data,
    labels: FORM_8962_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      monthlyPTC: [], netPTC: 3600,
      excessAdvanceRepayment: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    criticalNumericFields: ['netPTC'],
  },
  {
    name: 'Form 8938',
    prompt: getForm8938ExtractionPrompt,
    validate: validateForm8938Data,
    labels: FORM_8938_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'JOHN DOE', taxpayerSSN: null,
      foreignDepositAccounts: [], foreignFinancialAssets: [],
      foreignAssetsTotal: 250000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['foreignDepositAccounts', 'foreignFinancialAssets'],
    criticalNumericFields: ['foreignAssetsTotal'],
  },
]

// Prompt Generation
describe('IRS Forms Part 2 - Prompt Generation', () => {
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
describe('IRS Forms Part 2 - Validation Rejects Invalid', () => {
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
describe('IRS Forms Part 2 - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - Reject missing required fields
describe('IRS Forms Part 2 - Validation Rejects Missing Required Fields', () => {
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

// Validation - Reject non-array fields
describe('IRS Forms Part 2 - Validation Rejects Missing Arrays', () => {
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

// Validation - Reject wrong types on critical numeric fields
describe('IRS Forms Part 2 - Validation Rejects Wrong Numeric Types', () => {
  forms
    .filter((f) => f.criticalNumericFields && f.criticalNumericFields.length > 0)
    .forEach(({ name, validate, validData, criticalNumericFields }) => {
      criticalNumericFields!.forEach((field) => {
        it(`${name}: rejects non-number '${field}'`, () => {
          const bad = { ...validData, [field]: 'not-a-number' }
          expect(validate(bad)).toBe(false)
        })

        it(`${name}: accepts null '${field}'`, () => {
          const withNull = { ...validData, [field]: null }
          expect(validate(withNull)).toBe(true)
        })
      })
    })
})

// Vietnamese Labels
describe('IRS Forms Part 2 - Vietnamese Labels', () => {
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
