/**
 * IRS Forms Part 1 Unit Tests
 * Tests for 13 critical IRS form OCR extraction prompts (Phase 5)
 * Covers: 2441, 4562, 4797, 5695, 8283, 8606, 8829, 8863, 8889, 8949, 8959, 8960, 8995
 */
import { describe, it, expect } from 'vitest'

import { getForm2441ExtractionPrompt, validateForm2441Data, FORM_2441_FIELD_LABELS_VI } from '../form-2441'
import { getForm4562ExtractionPrompt, validateForm4562Data, FORM_4562_FIELD_LABELS_VI } from '../form-4562'
import { getForm4797ExtractionPrompt, validateForm4797Data, FORM_4797_FIELD_LABELS_VI } from '../form-4797'
import { getForm5695ExtractionPrompt, validateForm5695Data, FORM_5695_FIELD_LABELS_VI } from '../form-5695'
import { getForm8283ExtractionPrompt, validateForm8283Data, FORM_8283_FIELD_LABELS_VI } from '../form-8283'
import { getForm8606ExtractionPrompt, validateForm8606Data, FORM_8606_FIELD_LABELS_VI } from '../form-8606'
import { getForm8829ExtractionPrompt, validateForm8829Data, FORM_8829_FIELD_LABELS_VI } from '../form-8829'
import { getForm8863ExtractionPrompt, validateForm8863Data, FORM_8863_FIELD_LABELS_VI } from '../form-8863'
import { getForm8889ExtractionPrompt, validateForm8889Data, FORM_8889_FIELD_LABELS_VI } from '../form-8889'
import { getForm8949ExtractionPrompt, validateForm8949Data, FORM_8949_FIELD_LABELS_VI } from '../form-8949'
import { getForm8959ExtractionPrompt, validateForm8959Data, FORM_8959_FIELD_LABELS_VI } from '../form-8959'
import { getForm8960ExtractionPrompt, validateForm8960Data, FORM_8960_FIELD_LABELS_VI } from '../form-8960'
import { getForm8995ExtractionPrompt, validateForm8995Data, FORM_8995_FIELD_LABELS_VI } from '../form-8995'

const forms = [
  {
    name: 'Form 2441',
    prompt: getForm2441ExtractionPrompt,
    validate: validateForm2441Data,
    labels: FORM_2441_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'Jane Doe', taxpayerSSN: 'XXX-XX-XXXX',
      careProviders: [{ providerName: 'ABC Daycare', providerAddress: null, providerTIN: null, amountPaid: 8000 }],
      qualifyingPersons: [{ name: 'Child', ssn: null, qualifyingExpenses: 3000 }],
      totalQualifyingExpenses: 3000, earnedIncome: 55000, spouseEarnedIncome: null,
      smallerOfIncomes: null, allowableExpenses: 3000, creditPercentage: 20,
      creditAmount: 600, dependentCareBenefits: null, forfeited: null,
      excludableBenefits: null, taxableBenefits: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['careProviders', 'qualifyingPersons'],
    criticalNumericFields: ['creditAmount'],
  },
  {
    name: 'Form 4562',
    prompt: getForm4562ExtractionPrompt,
    validate: validateForm4562Data,
    labels: FORM_4562_FIELD_LABELS_VI,
    validData: {
      businessName: 'Smith LLC', businessActivity: 'Consulting',
      section179MaxDeduction: null, section179PhaseoutThreshold: null,
      section179CostOfProperty: null, section179Deduction: 25000,
      specialDepreciationAllowance: null,
      macrsDeductions: [{ propertyDescription: 'Equipment', dateAcquired: null, costBasis: 10000, recoveryPeriod: '7-yr', convention: 'HY', method: 'GDS', depreciation: 1429 }],
      totalMacrsDeduction: 1429, totalDepreciationLine22: 26429,
      listedPropertyDeductions: null, totalDepreciation: 26429, taxYear: 2024,
    },
    requiredFields: ['businessName'],
    arrayFields: ['macrsDeductions'],
    criticalNumericFields: ['section179Deduction', 'totalDepreciation'],
  },
  {
    name: 'Form 4797',
    prompt: getForm4797ExtractionPrompt,
    validate: validateForm4797Data,
    labels: FORM_4797_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      section1231Gains: [{ description: 'Office', dateAcquired: null, dateSold: null, grossSalesPrice: 500000, costBasis: 350000, depreciation: 75000, gainLoss: 225000 }],
      totalSection1231GainLoss: 225000,
      ordinaryGains: [], totalOrdinaryGainLoss: null,
      section1245Recapture: null, section1250Recapture: 75000, totalRecapture: 75000,
      installmentSaleGain: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['section1231Gains', 'ordinaryGains'],
    criticalNumericFields: ['totalSection1231GainLoss'],
  },
  {
    name: 'Form 5695',
    prompt: getForm5695ExtractionPrompt,
    validate: validateForm5695Data,
    labels: FORM_5695_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      solarElectric: 25000, solarWaterHeating: null, fuelCellProperty: null,
      smallWindEnergy: null, geothermalHeatPump: null, batteryStorageTechnology: null,
      qualifiedCleanEnergyTotal: 25000, cleanEnergyCredit: 7500,
      qualifiedEnergyProperty: null, residentialEnergyProperty: null,
      doorsWindows: null, heatPumps: null, biomassStoves: null, homeEnergyAudit: null,
      totalHomeImprovement: null, homeImprovementCredit: null,
      totalResidentialEnergyCredit: 7500, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['cleanEnergyCredit', 'totalResidentialEnergyCredit'],
  },
  {
    name: 'Form 8283',
    prompt: getForm8283ExtractionPrompt,
    validate: validateForm8283Data,
    labels: FORM_8283_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      sectionADonations: [{ doneeOrganization: 'Goodwill', doneeAddress: null, description: 'Clothing', dateContributed: null, dateAcquired: null, howAcquired: 'Purchase', donorCostBasis: 500, fairMarketValue: 300, methodOfFMV: 'Thrift' }],
      sectionBDonations: [],
      totalNoncashDeduction: 300, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['sectionADonations', 'sectionBDonations'],
    criticalNumericFields: ['totalNoncashDeduction'],
  },
  {
    name: 'Form 8606',
    prompt: getForm8606ExtractionPrompt,
    validate: validateForm8606Data,
    labels: FORM_8606_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      nondeductibleContributions: 7000, totalBasisPriorYears: 35000,
      totalBasis: 42000, totalIRAValue: 150000, distributionsReceived: null,
      nontaxablePortionOfDistribution: null, taxableAmountOfDistribution: null,
      basisRemainingEndOfYear: 42000, rothConversionAmount: null,
      rothConversionTaxable: null, rothDistributions: null,
      rothContributionBasis: null, rothTaxableAmount: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['rothConversionTaxable', 'taxableAmountOfDistribution'],
  },
  {
    name: 'Form 8829',
    prompt: getForm8829ExtractionPrompt,
    validate: validateForm8829Data,
    labels: FORM_8829_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', homeSquareFootage: 2000, businessSquareFootage: 300,
      businessPercentage: 15, directExpenses: null, indirectExpenses: 12000,
      casualtyLosses: null, mortgageInterest: 8000, realEstateTaxes: 4000,
      insurance: 1200, repairsMaintenance: null, utilities: 3600, otherExpenses: null,
      totalExpensesBeforeLimit: 2595, depreciationOfHome: 1500,
      carryoverFromPriorYear: null, totalAllowableDeduction: 4095,
      carryoverToNextYear: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['businessPercentage', 'totalAllowableDeduction'],
  },
  {
    name: 'Form 8863',
    prompt: getForm8863ExtractionPrompt,
    validate: validateForm8863Data,
    labels: FORM_8863_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      students: [{ studentName: 'Jane Doe', studentSSN: null, institutionName: 'State U', institutionEIN: null, qualifiedExpenses: 8000, creditType: 'AOTC' as const }],
      tentativeAOTC: 2500, refundableAOTC: 1000, nonrefundableAOTC: 1500,
      lifetimeLearningCredit: null, totalNonrefundableCredits: 1500,
      totalQualifiedExpenses: 8000, americanOpportunityCredit: 2500,
      totalEducationCredits: 2500, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['students'],
    criticalNumericFields: ['refundableAOTC', 'totalEducationCredits'],
  },
  {
    name: 'Form 8889',
    prompt: getForm8889ExtractionPrompt,
    validate: validateForm8889Data,
    labels: FORM_8889_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null, coverageType: 'FAMILY' as const,
      hsaContributions: 7300, employerContributions: 1500, totalContributions: 8800,
      contributionLimit: 8300, hsaDeduction: 7300, totalDistributions: 3000,
      rollovers: null, qualifiedDistributions: 3000, taxableDistributions: 0,
      excessDistributions: null, excessContributionTax: null,
      additionalTaxOnDistributions: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['hsaDeduction', 'taxableDistributions'],
  },
  {
    name: 'Form 8949',
    prompt: getForm8949ExtractionPrompt,
    validate: validateForm8949Data,
    labels: FORM_8949_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      shortTermTransactions: [{ description: '100 sh AAPL', dateAcquired: '06/15/2024', dateSold: '09/20/2024', proceeds: 22000, costBasis: 19500, adjustmentCode: null, adjustmentAmount: null, gainLoss: 2500 }],
      shortTermCheckbox: 'A' as const,
      longTermTransactions: [],
      longTermCheckbox: null,
      totalShortTermProceeds: 22000, totalShortTermBasis: 19500,
      totalShortTermGainLoss: 2500, totalLongTermProceeds: null,
      totalLongTermBasis: null, totalLongTermGainLoss: null, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['shortTermTransactions', 'longTermTransactions'],
    criticalNumericFields: ['totalShortTermGainLoss', 'totalLongTermGainLoss'],
  },
  {
    name: 'Form 8959',
    prompt: getForm8959ExtractionPrompt,
    validate: validateForm8959Data,
    labels: FORM_8959_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      medicareWages: 275000, unreportedMedicareWages: null,
      wageThreshold: 200000, excessWages: 75000,
      additionalMedicareTaxOnWages: 675, selfEmploymentIncome: null,
      excessSEIncome: null, additionalMedicareTaxOnSE: null,
      rrtaCompensation: null, additionalMedicareTaxOnRRTA: null,
      totalAdditionalMedicareTax: 675, medicareTaxWithheld: 3987.50,
      excessWithholding: 1087.50, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['totalAdditionalMedicareTax'],
  },
  {
    name: 'Form 8960',
    prompt: getForm8960ExtractionPrompt,
    validate: validateForm8960Data,
    labels: FORM_8960_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      taxableInterest: 15000, annuitiesNonqualified: null,
      rentalRoyaltyPartnership: 25000, capitalGainLoss: 50000,
      otherGainsLosses: null, otherInvestmentIncome: null,
      totalInvestmentIncome: 90000, investmentInterestExpense: 2000,
      stateTaxOnInvestmentIncome: null, otherDeductions: null, totalDeductions: 2000,
      netInvestmentIncome: 88000, modifiedAGI: 300000, threshold: 250000,
      excessOverThreshold: 50000, smallerOfNIIOrExcess: 50000,
      niitTax: 1900, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: [],
    criticalNumericFields: ['niitTax', 'netInvestmentIncome'],
  },
  {
    name: 'Form 8995',
    prompt: getForm8995ExtractionPrompt,
    validate: validateForm8995Data,
    labels: FORM_8995_FIELD_LABELS_VI,
    validData: {
      taxpayerName: 'John Doe', taxpayerSSN: null,
      businesses: [{ businessName: 'Doe Consulting', businessTIN: null, qualifiedBusinessIncome: 80000 }],
      totalQBI: 80000, qbiComponentDeduction: 16000,
      qualifiedREITDividends: null, qualifiedPTPIncome: null, reitPTPDeduction: null,
      totalQBIDeduction: 16000, taxableIncomeBeforeQBI: 120000,
      netCapitalGain: null, incomeLimit: 120000, incomeLimitDeduction: 24000,
      qbiDeduction: 16000, taxYear: 2024,
    },
    requiredFields: ['taxpayerName'],
    arrayFields: ['businesses'],
    criticalNumericFields: ['qbiDeduction'],
  },
]

// Prompt Generation
describe('IRS Forms Part 1 - Prompt Generation', () => {
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
describe('IRS Forms Part 1 - Validation Rejects Invalid', () => {
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
describe('IRS Forms Part 1 - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - Reject missing required fields
describe('IRS Forms Part 1 - Validation Rejects Missing Required Fields', () => {
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

// Validation - Reject missing array fields
describe('IRS Forms Part 1 - Validation Rejects Missing Arrays', () => {
  forms
    .filter((f) => f.arrayFields.length > 0)
    .forEach(({ name, validate, validData, arrayFields }) => {
      arrayFields.forEach((field) => {
        it(`${name}: rejects non-array '${field}'`, () => {
          const bad = { ...validData, [field]: 'not-an-array' }
          expect(validate(bad)).toBe(false)
        })
      })
    })
})

// Validation - Reject wrong types on critical numeric fields
describe('IRS Forms Part 1 - Validation Rejects Wrong Numeric Types', () => {
  forms.forEach(({ name, validate, validData, criticalNumericFields }) => {
    criticalNumericFields.forEach((field) => {
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
describe('IRS Forms Part 1 - Vietnamese Labels', () => {
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
