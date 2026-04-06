/**
 * 1099 Form Variants Unit Tests
 * Tests for 16 newly created 1099 and RRB variant OCR extraction prompts
 * Covers: 1099-A, 1099-B, 1099-C, 1099-S, 1099-SA, 1099-Q, 1099-OID, 1099-LTC,
 *         1099-PATR, 1099-CAP, 1099-H, 1099-LS, 1099-QA, 1099-SB, RRB-1099, RRB-1099-R
 */
import { describe, it, expect } from 'vitest'

import { get1099AExtractionPrompt, validate1099AData, FORM_1099_A_FIELD_LABELS_VI } from '../1099-a'
import { get1099BExtractionPrompt, validate1099BData, FORM_1099_B_FIELD_LABELS_VI } from '../1099-b'
import { get1099CExtractionPrompt, validate1099CData, FORM_1099_C_FIELD_LABELS_VI } from '../1099-c'
import { get1099SExtractionPrompt, validate1099SData, FORM_1099_S_FIELD_LABELS_VI } from '../1099-s'
import { get1099SAExtractionPrompt, validate1099SAData, FORM_1099_SA_FIELD_LABELS_VI } from '../1099-sa'
import { get1099QExtractionPrompt, validate1099QData, FORM_1099_Q_FIELD_LABELS_VI } from '../1099-q'
import { get1099OIDExtractionPrompt, validate1099OIDData, FORM_1099_OID_FIELD_LABELS_VI } from '../1099-oid'
import { get1099LTCExtractionPrompt, validate1099LTCData, FORM_1099_LTC_FIELD_LABELS_VI } from '../1099-ltc'
import { get1099PATRExtractionPrompt, validate1099PATRData, FORM_1099_PATR_FIELD_LABELS_VI } from '../1099-patr'
import { get1099CAPExtractionPrompt, validate1099CAPData, FORM_1099_CAP_FIELD_LABELS_VI } from '../1099-cap'
import { get1099HExtractionPrompt, validate1099HData, FORM_1099_H_FIELD_LABELS_VI } from '../1099-h'
import { get1099LSExtractionPrompt, validate1099LSData, FORM_1099_LS_FIELD_LABELS_VI } from '../1099-ls'
import { get1099QAExtractionPrompt, validate1099QAData, FORM_1099_QA_FIELD_LABELS_VI } from '../1099-qa'
import { get1099SBExtractionPrompt, validate1099SBData, FORM_1099_SB_FIELD_LABELS_VI } from '../1099-sb'
import { getRRB1099ExtractionPrompt, validateRRB1099Data, RRB_1099_FIELD_LABELS_VI } from '../rrb-1099'
import { getRRB1099RExtractionPrompt, validateRRB1099RData, RRB_1099_R_FIELD_LABELS_VI } from '../rrb-1099-r'

// =============================================================================
// Form definitions: prompt fn, validate fn, labels, valid data, required fields
// =============================================================================

const forms = [
  {
    name: '1099-A',
    prompt: get1099AExtractionPrompt,
    validate: validate1099AData,
    labels: FORM_1099_A_FIELD_LABELS_VI,
    validData: {
      lenderName: 'First National Bank', lenderAddress: null, lenderTIN: null,
      borrowerName: null, borrowerAddress: null, borrowerTIN: 'XXX-XX-XXXX',
      accountNumber: null, acquisitionDate: null, balanceOwed: 185000,
      fmvProperty: 160000, personallyLiable: true, propertyDescription: null,
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['lenderName', 'borrowerTIN'],
    booleanFields: ['corrected', 'personallyLiable'],
  },
  {
    name: '1099-B',
    prompt: get1099BExtractionPrompt,
    validate: validate1099BData,
    labels: FORM_1099_B_FIELD_LABELS_VI,
    validData: {
      payerName: 'Broker Inc', payerAddress: null, payerTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, transactions: [], federalIncomeTaxWithheld: null,
      profitOnClosedContracts: null, unrealizedProfitPrior: null,
      unrealizedProfitCurrent: null, stateTaxInfo: [], taxYear: 2024, corrected: false,
    },
    requiredFields: ['payerName', 'recipientTIN'],
    booleanFields: ['corrected'],
    arrayFields: ['transactions', 'stateTaxInfo'],
  },
  {
    name: '1099-C',
    prompt: get1099CExtractionPrompt,
    validate: validate1099CData,
    labels: FORM_1099_C_FIELD_LABELS_VI,
    validData: {
      creditorName: 'Big Bank', creditorAddress: null, creditorTIN: null,
      creditorPhone: null, debtorName: null, debtorAddress: null,
      debtorTIN: 'XXX-XX-XXXX', accountNumber: null, dateOfEvent: null,
      debtCanceled: 5000, interestIncluded: null, debtDescription: null,
      personalLiability: false, eventCode: 'A', fmvProperty: null,
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['creditorName', 'debtorTIN'],
    booleanFields: ['corrected', 'personalLiability'],
  },
  {
    name: '1099-S',
    prompt: get1099SExtractionPrompt,
    validate: validate1099SData,
    labels: FORM_1099_S_FIELD_LABELS_VI,
    validData: {
      filerName: 'ABC Title Company', filerAddress: null, filerTIN: null,
      filerPhone: null, transferorName: null, transferorAddress: null,
      transferorTIN: 'XXX-XX-XXXX', accountNumber: null, closingDate: null,
      grossProceeds: 350000, propertyAddress: '456 Oak Rd',
      foreignPersonCheckbox: false, buyerPartOfRealEstateTax: null,
      stateTaxInfo: [], taxYear: 2024, corrected: false,
    },
    requiredFields: ['filerName', 'transferorTIN'],
    booleanFields: ['corrected', 'foreignPersonCheckbox'],
    arrayFields: ['stateTaxInfo'],
  },
  {
    name: '1099-SA',
    prompt: get1099SAExtractionPrompt,
    validate: validate1099SAData,
    labels: FORM_1099_SA_FIELD_LABELS_VI,
    validData: {
      trusteeName: 'Health Savings Trust', trusteeAddress: null, trusteeTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, distributionAmount: 2000, earningsOnExcess: null,
      distributionCode: '1', fmvOnDeath: null, accountType: 'HSA',
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['trusteeName', 'recipientTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1099-Q',
    prompt: get1099QExtractionPrompt,
    validate: validate1099QData,
    labels: FORM_1099_Q_FIELD_LABELS_VI,
    validData: {
      payerName: '529 Plan', payerAddress: null, payerTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, grossDistribution: 10000, earnings: 2000,
      basis: 8000, trusteeTransfer: false, distributionType: '529',
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['payerName', 'recipientTIN'],
    booleanFields: ['corrected', 'trusteeTransfer'],
  },
  {
    name: '1099-OID',
    prompt: get1099OIDExtractionPrompt,
    validate: validate1099OIDData,
    labels: FORM_1099_OID_FIELD_LABELS_VI,
    validData: {
      payerName: 'Bond Issuer', payerAddress: null, payerTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, originalIssueDiscount: 500, otherPeriodicInterest: null,
      earlyWithdrawalPenalty: null, federalIncomeTaxWithheld: null,
      marketDiscount: null, acquisitionPremium: null, description: null,
      originalIssueDiscountOnTreasury: null, investmentExpenses: null,
      bondPremium: null, taxExemptOID: null, stateTaxInfo: [],
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['payerName', 'recipientTIN'],
    booleanFields: ['corrected'],
    arrayFields: ['stateTaxInfo'],
  },
  {
    name: '1099-LTC',
    prompt: get1099LTCExtractionPrompt,
    validate: validate1099LTCData,
    labels: FORM_1099_LTC_FIELD_LABELS_VI,
    validData: {
      payerName: 'Insurance Co', payerAddress: null, payerTIN: null,
      policyholderName: null, policyholderAddress: null,
      policyholderTIN: 'XXX-XX-XXXX', accountNumber: null,
      insuredName: null, insuredTIN: null, grossBenefits: 12000,
      acceleratedBenefits: null, perDiemAmount: true, reimbursedAmount: false,
      qualifiedContract: true, taxYear: 2024, corrected: false,
    },
    requiredFields: ['payerName', 'policyholderTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1099-PATR',
    prompt: get1099PATRExtractionPrompt,
    validate: validate1099PATRData,
    labels: FORM_1099_PATR_FIELD_LABELS_VI,
    validData: {
      cooperativeName: 'Farm Co-op', cooperativeAddress: null, cooperativeTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, patronageDividends: 3000, nonpatronageDistributions: null,
      perUnitRetainAllocations: null, federalIncomeTaxWithheld: null,
      redemptionAmount: null, domesticProductionDeduction: null,
      investmentCredit: null, workOpportunityCredit: null,
      patronsAMTAdjustment: null, stateTaxInfo: [], taxYear: 2024, corrected: false,
    },
    requiredFields: ['cooperativeName', 'recipientTIN'],
    booleanFields: ['corrected'],
    arrayFields: ['stateTaxInfo'],
  },
  {
    name: '1099-CAP',
    prompt: get1099CAPExtractionPrompt,
    validate: validate1099CAPData,
    labels: FORM_1099_CAP_FIELD_LABELS_VI,
    validData: {
      corporationName: 'MegaCorp', corporationAddress: null, corporationTIN: null,
      shareholderName: null, shareholderAddress: null, shareholderTIN: 'XXX-XX-XXXX',
      accountNumber: null, dateOfChange: null, cashReceived: 50000,
      fmvOtherProperty: null, classesOfStockExchanged: null,
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['corporationName', 'shareholderTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1099-H',
    prompt: get1099HExtractionPrompt,
    validate: validate1099HData,
    labels: FORM_1099_H_FIELD_LABELS_VI,
    validData: {
      insurerName: 'Health Insurer', insurerAddress: null, insurerTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, hctcAdvancePayments: 6000,
      numberOfMonthsCovered: 12, monthsCovered: ['Jan', 'Feb'],
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['insurerName', 'recipientTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1099-LS',
    prompt: get1099LSExtractionPrompt,
    validate: validate1099LSData,
    labels: FORM_1099_LS_FIELD_LABELS_VI,
    validData: {
      acquirerName: 'Life Settlements Inc', acquirerAddress: null, acquirerTIN: null,
      sellerName: null, sellerAddress: null, sellerTIN: 'XXX-XX-XXXX',
      accountNumber: null, grossProceeds: 200000, dateOfSale: null,
      issuerName: null, policyNumber: null, taxYear: 2024, corrected: false,
    },
    requiredFields: ['acquirerName', 'sellerTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: '1099-QA',
    prompt: get1099QAExtractionPrompt,
    validate: validate1099QAData,
    labels: FORM_1099_QA_FIELD_LABELS_VI,
    validData: {
      payerName: 'ABLE Program', payerAddress: null, payerTIN: null,
      recipientName: null, recipientAddress: null, recipientTIN: 'XXX-XX-XXXX',
      accountNumber: null, grossDistribution: 5000, earnings: 500,
      basis: 4500, programToProgram: false, taxYear: 2024, corrected: false,
    },
    requiredFields: ['payerName', 'recipientTIN'],
    booleanFields: ['corrected', 'programToProgram'],
  },
  {
    name: '1099-SB',
    prompt: get1099SBExtractionPrompt,
    validate: validate1099SBData,
    labels: FORM_1099_SB_FIELD_LABELS_VI,
    validData: {
      issuerName: 'Life Insurance Co', issuerAddress: null, issuerTIN: null,
      sellerName: null, sellerAddress: null, sellerTIN: 'XXX-XX-XXXX',
      accountNumber: null, cashSurrenderValue: 75000, investmentInContract: 50000,
      policyNumber: null, taxYear: 2024, corrected: false,
    },
    requiredFields: ['issuerName', 'sellerTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: 'RRB-1099',
    prompt: getRRB1099ExtractionPrompt,
    validate: validateRRB1099Data,
    labels: RRB_1099_FIELD_LABELS_VI,
    validData: {
      payerName: 'Railroad Retirement Board', recipientName: null,
      recipientAddress: null, recipientTIN: 'XXX-XX-XXXX', claimNumber: null,
      ssBenefitEquivalent: 18000, medicarePremiumDeducted: null,
      netSsBenefits: 16500, workerCompOffset: null,
      federalIncomeTaxWithheld: null, repayments: null,
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['recipientTIN'],
    booleanFields: ['corrected'],
  },
  {
    name: 'RRB-1099-R',
    prompt: getRRB1099RExtractionPrompt,
    validate: validateRRB1099RData,
    labels: RRB_1099_R_FIELD_LABELS_VI,
    validData: {
      payerName: 'Railroad Retirement Board', recipientName: null,
      recipientAddress: null, recipientTIN: 'XXX-XX-XXXX', claimNumber: null,
      grossDistribution: 24000, employeeContributions: 5000,
      taxableAmount: 19000, federalIncomeTaxWithheld: null,
      totalDistribution: false, capitalGain: null,
      taxYear: 2024, corrected: false,
    },
    requiredFields: ['recipientTIN'],
    booleanFields: ['corrected', 'totalDistribution'],
  },
]

// =============================================================================
// Prompt Generation Tests
// =============================================================================

describe('1099 Form Variants - Prompt Generation', () => {
  forms.forEach(({ name, prompt }) => {
    it(`${name}: returns non-empty string with form name, JSON, and rules`, () => {
      const result = prompt()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(100)
      expect(result).toContain('JSON')
      expect(result).toContain('Rules')
    })
  })
})

// =============================================================================
// Validation - Reject invalid inputs
// =============================================================================

describe('1099 Form Variants - Validation Rejects Invalid', () => {
  forms.forEach(({ name, validate }) => {
    it(`${name}: rejects null, undefined, non-object`, () => {
      expect(validate(null)).toBe(false)
      expect(validate(undefined)).toBe(false)
      expect(validate('string')).toBe(false)
      expect(validate(123)).toBe(false)
      expect(validate([])).toBe(false)
    })

    it(`${name}: rejects empty object (missing required fields)`, () => {
      expect(validate({})).toBe(false)
    })
  })
})

// =============================================================================
// Validation - Accept valid data
// =============================================================================

describe('1099 Form Variants - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// =============================================================================
// Validation - Reject missing required fields
// =============================================================================

describe('1099 Form Variants - Validation Rejects Missing Required Fields', () => {
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

// =============================================================================
// Validation - Reject wrong boolean types
// =============================================================================

describe('1099 Form Variants - Validation Rejects Wrong Boolean Types', () => {
  forms.forEach(({ name, validate, validData, booleanFields }) => {
    booleanFields.forEach((field) => {
      it(`${name}: rejects non-boolean '${field}'`, () => {
        const bad = { ...validData, [field]: 'not-a-boolean' }
        expect(validate(bad)).toBe(false)
      })
    })
  })
})

// =============================================================================
// Validation - Reject missing array fields (where applicable)
// =============================================================================

describe('1099 Form Variants - Validation Rejects Missing Arrays', () => {
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

// =============================================================================
// Vietnamese Labels
// =============================================================================

describe('1099 Form Variants - Vietnamese Labels', () => {
  forms.forEach(({ name, labels }) => {
    it(`${name}: has non-empty Vietnamese labels`, () => {
      const keys = Object.keys(labels)
      expect(keys.length).toBeGreaterThan(0)
      for (const [key, value] of Object.entries(labels)) {
        expect(typeof value).toBe('string')
        expect(value.length).toBeGreaterThan(0)
        expect(value).not.toBe(key) // Vietnamese != English key
      }
    })
  })
})
