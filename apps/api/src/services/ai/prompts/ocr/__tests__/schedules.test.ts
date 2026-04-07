/**
 * Schedules Unit Tests (Phase 3)
 * Tests for 10 schedule OCR extraction prompts
 * Covers: Schedule A, B, 2, 3, 8812, EIC, F, H, J, R
 */
import { describe, it, expect } from 'vitest'

import { getScheduleAExtractionPrompt, validateScheduleAData, SCHEDULE_A_FIELD_LABELS_VI } from '../schedule-a'
import { getScheduleBExtractionPrompt, validateScheduleBData, SCHEDULE_B_FIELD_LABELS_VI } from '../schedule-b'
import { getSchedule2ExtractionPrompt, validateSchedule2Data, SCHEDULE_2_FIELD_LABELS_VI } from '../schedule-2'
import { getSchedule3ExtractionPrompt, validateSchedule3Data, SCHEDULE_3_FIELD_LABELS_VI } from '../schedule-3'
import { getSchedule8812ExtractionPrompt, validateSchedule8812Data, SCHEDULE_8812_FIELD_LABELS_VI } from '../schedule-8812'
import { getScheduleEICExtractionPrompt, validateScheduleEICData, SCHEDULE_EIC_FIELD_LABELS_VI } from '../schedule-eic'
import { getScheduleFExtractionPrompt, validateScheduleFData, SCHEDULE_F_FIELD_LABELS_VI } from '../schedule-f'
import { getScheduleHExtractionPrompt, validateScheduleHData, SCHEDULE_H_FIELD_LABELS_VI } from '../schedule-h'
import { getScheduleJExtractionPrompt, validateScheduleJData, SCHEDULE_J_FIELD_LABELS_VI } from '../schedule-j'
import { getScheduleRExtractionPrompt, validateScheduleRData, SCHEDULE_R_FIELD_LABELS_VI } from '../schedule-r'

const forms = [
  {
    name: 'Schedule A',
    prompt: getScheduleAExtractionPrompt,
    validate: validateScheduleAData,
    labels: SCHEDULE_A_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      medicalExpenses: 5000, stateLocalIncomeTax: 8000, realEstateTaxes: 4000,
      homeMortgageInterest: 12000, charityCash: 2000, charityNonCash: null,
      totalTaxesPaid: 12000, totalItemizedDeductions: 38000, taxYear: 2024,
    },
    requiredNumericFields: ['totalItemizedDeductions'],
  },
  {
    name: 'Schedule B',
    prompt: getScheduleBExtractionPrompt,
    validate: validateScheduleBData,
    labels: SCHEDULE_B_FIELD_LABELS_VI,
    validData: {
      interestSources: [{ payerName: 'Chase Bank', amount: 1050 }],
      dividendSources: [{ payerName: 'Vanguard', amount: 1000 }],
      totalTaxableInterest: 2050, totalOrdinaryDividends: 1000,
      hasForeignAccounts: false, hasForeignTrust: false, taxYear: 2024,
    },
    requiredNumericFields: ['totalTaxableInterest'],
    arrayFields: ['interestSources', 'dividendSources'],
  },
  {
    name: 'Schedule 2',
    prompt: getSchedule2ExtractionPrompt,
    validate: validateSchedule2Data,
    labels: SCHEDULE_2_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      alternativeMinimumTax: null, excessPremiumTaxCredit: null,
      selfEmploymentTax: 2500, partITotal: 2500,
      unreportedSSTax: null, additionalMedicareTax: null,
      netInvestmentIncomeTax: null, partIITotal: null,
      totalAdditionalTax: 2500, taxYear: 2024,
    },
    requiredNumericFields: ['partITotal'],
  },
  {
    name: 'Schedule 3',
    prompt: getSchedule3ExtractionPrompt,
    validate: validateSchedule3Data,
    labels: SCHEDULE_3_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      foreignTaxCredit: null, childDependentCareCredit: 1200,
      educationCredits: null, retirementSavingsCredit: null,
      residentialEnergyCredit: null, totalNonrefundableCredits: 4000,
      estimatedTaxPayments: null, extensionPayment: null,
      excessSSTaxWithheld: null, totalOtherPayments: null, taxYear: 2024,
    },
    requiredNumericFields: ['totalNonrefundableCredits'],
  },
  {
    name: 'Schedule 8812',
    prompt: getSchedule8812ExtractionPrompt,
    validate: validateSchedule8812Data,
    labels: SCHEDULE_8812_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      numberOfQualifyingChildren: 2, childTaxCredit: 4000,
      additionalChildTaxCredit: null, otherDependentCredit: null,
      earnedIncome: 55000, taxYear: 2024,
    },
    requiredNumericFields: ['childTaxCredit'],
  },
  {
    name: 'Schedule EIC',
    prompt: getScheduleEICExtractionPrompt,
    validate: validateScheduleEICData,
    labels: SCHEDULE_EIC_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe',
      children: [
        { childName: 'Jane Doe Jr', childSSN: null, yearOfBirth: 2018, relationship: 'Daughter', monthsLivedWithYou: 12, studentUnder24: null, permanentlyDisabled: null },
      ],
      taxYear: 2024,
    },
    requiredStringFields: ['taxpayerName'],
  },
  {
    name: 'Schedule F',
    prompt: getScheduleFExtractionPrompt,
    validate: validateScheduleFData,
    labels: SCHEDULE_F_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      principalProduct: 'Corn', farmName: null,
      grossFarmIncome: 120000, totalExpenses: 131800,
      netFarmProfit: -11800, materialParticipation: true, taxYear: 2024,
    },
    requiredNumericFields: ['netFarmProfit'],
  },
  {
    name: 'Schedule H',
    prompt: getScheduleHExtractionPrompt,
    validate: validateScheduleHData,
    labels: SCHEDULE_H_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      cashWagesPaid: 32000, ssTaxWithheld: null,
      medicareTaxWithheld: null, federalIncomeTaxWithheld: null,
      totalHouseholdTax: 4914, taxYear: 2024,
    },
    requiredNumericFields: ['totalHouseholdTax'],
  },
  {
    name: 'Schedule J',
    prompt: getScheduleJExtractionPrompt,
    validate: validateScheduleJData,
    labels: SCHEDULE_J_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      electiveFarmIncome: 60000, electiveFishingIncome: null,
      priorYear1TaxableIncome: null, priorYear2TaxableIncome: null,
      priorYear3TaxableIncome: null, averagedTax: 14000, taxYear: 2024,
    },
    requiredNumericFields: ['averagedTax'],
  },
  {
    name: 'Schedule R',
    prompt: getScheduleRExtractionPrompt,
    validate: validateScheduleRData,
    labels: SCHEDULE_R_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      age65OrOlder: true, spouseAge65OrOlder: null,
      permanentlyDisabled: null, spousePermanentlyDisabled: null,
      initialAmount: 5000, adjustedGrossIncome: null,
      nontaxableSsBenefits: null, creditAmount: 750, taxYear: 2024,
    },
    requiredNumericFields: ['creditAmount'],
  },
]

// Prompt Generation
describe('Schedules - Prompt Generation', () => {
  forms.forEach(({ name, prompt }) => {
    it(`${name}: returns non-empty string with JSON and extraction instructions`, () => {
      const result = prompt()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(100)
      expect(result).toContain('JSON')
      // Some prompts use 'Rules', others use 'IMPORTANT' for instructions
      expect(result).toMatch(/Rules|IMPORTANT/)
    })
  })
})

// Validation - Reject invalid inputs
describe('Schedules - Validation Rejects Invalid', () => {
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
describe('Schedules - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - OR-based validators reject data with all key fields as null
describe('Schedules - OR-Based Validation Rejects All-Null Key Fields', () => {
  it('Schedule A: rejects data with no valid numeric key fields', () => {
    expect(validateScheduleAData({ totalItemizedDeductions: null, totalTaxesPaid: null })).toBe(false)
  })

  it('Schedule B: rejects data with no valid numeric key fields', () => {
    expect(validateScheduleBData({ totalTaxableInterest: null, totalOrdinaryDividends: null, interestSources: [], dividendSources: [] })).toBe(false)
  })

  it('Schedule 2: rejects data with no valid numeric key fields', () => {
    expect(validateSchedule2Data({ partITotal: null, partIITotal: null, totalAdditionalTax: null })).toBe(false)
  })

  it('Schedule 3: rejects data with no valid numeric key fields', () => {
    expect(validateSchedule3Data({ totalNonrefundableCredits: null, totalOtherPayments: null })).toBe(false)
  })

  it('Schedule 8812: rejects data with no valid numeric key fields', () => {
    expect(validateSchedule8812Data({ childTaxCredit: null, additionalChildTaxCredit: null, numberOfQualifyingChildren: null })).toBe(false)
  })
})

// Vietnamese Labels
describe('Schedules - Vietnamese Labels', () => {
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
