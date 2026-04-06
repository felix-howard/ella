/**
 * Semi-Structured Documents Unit Tests (Phase 8)
 * Tests for 35 semi-structured document OCR extraction prompts
 */
import { describe, it, expect } from 'vitest'

import { getItinLetterExtractionPrompt, validateItinLetterData, ITIN_LETTER_FIELD_LABELS_VI } from '../itin-letter'
import { getPayStubExtractionPrompt, validatePayStubData, PAY_STUB_FIELD_LABELS_VI } from '../pay-stub'
import { getGreenCardExtractionPrompt, validateGreenCardData, GREEN_CARD_FIELD_LABELS_VI } from '../green-card'
import { getStockOptionAgreementExtractionPrompt, validateStockOptionAgreementData, STOCK_OPTION_AGREEMENT_FIELD_LABELS_VI } from '../stock-option-agreement'
import { getRsuStatementExtractionPrompt, validateRsuStatementData, RSU_STATEMENT_FIELD_LABELS_VI } from '../rsu-statement'
import { getNaturalizationCertificateExtractionPrompt, validateNaturalizationCertificateData, NATURALIZATION_CERTIFICATE_FIELD_LABELS_VI } from '../naturalization-certificate'
import { getBrokerageStatementExtractionPrompt, validateBrokerageStatementData, BROKERAGE_STATEMENT_FIELD_LABELS_VI } from '../brokerage-statement'
import { getPropertyTaxStatementExtractionPrompt, validatePropertyTaxStatementData, PROPERTY_TAX_STATEMENT_FIELD_LABELS_VI } from '../property-tax-statement'
import { getEsppStatementExtractionPrompt, validateEsppStatementData, ESPP_STATEMENT_FIELD_LABELS_VI } from '../espp-statement'
import { getWorkVisaExtractionPrompt, validateWorkVisaData, WORK_VISA_FIELD_LABELS_VI } from '../work-visa'
import { getMarriageCertificateExtractionPrompt, validateMarriageCertificateData, MARRIAGE_CERTIFICATE_FIELD_LABELS_VI } from '../marriage-certificate'
import { getDivorceDecreeExtractionPrompt, validateDivorceDecreeData, DIVORCE_DECREE_FIELD_LABELS_VI } from '../divorce-decree'
import { getPowerOfAttorneyExtractionPrompt, validatePowerOfAttorneyData, POWER_OF_ATTORNEY_FIELD_LABELS_VI } from '../power-of-attorney'
import { getClosingDisclosureExtractionPrompt, validateClosingDisclosureData, CLOSING_DISCLOSURE_FIELD_LABELS_VI } from '../closing-disclosure'
import { getHud1ExtractionPrompt, validateHud1Data, HUD_1_FIELD_LABELS_VI } from '../hud-1'
import { getPmiStatementExtractionPrompt, validatePmiStatementData, PMI_STATEMENT_FIELD_LABELS_VI } from '../pmi-statement'
import { getMortgagePointsStatementExtractionPrompt, validateMortgagePointsStatementData, MORTGAGE_POINTS_STATEMENT_FIELD_LABELS_VI } from '../mortgage-points-statement'
import { getEstimatedTaxPaymentExtractionPrompt, validateEstimatedTaxPaymentData, ESTIMATED_TAX_PAYMENT_FIELD_LABELS_VI } from '../estimated-tax-payment'
import { getExtensionPaymentProofExtractionPrompt, validateExtensionPaymentProofData, EXTENSION_PAYMENT_PROOF_FIELD_LABELS_VI } from '../extension-payment-proof'
import { getPriorYearReturnExtractionPrompt, validatePriorYearReturnData, PRIOR_YEAR_RETURN_FIELD_LABELS_VI } from '../prior-year-return'
import { getCryptoTaxReportExtractionPrompt, validateCryptoTaxReportData, CRYPTO_TAX_REPORT_FIELD_LABELS_VI } from '../crypto-tax-report'
import { getForeignBankStatementExtractionPrompt, validateForeignBankStatementData, FOREIGN_BANK_STATEMENT_FIELD_LABELS_VI } from '../foreign-bank-statement'
import { getForeignTaxStatementExtractionPrompt, validateForeignTaxStatementData, FOREIGN_TAX_STATEMENT_FIELD_LABELS_VI } from '../foreign-tax-statement'
import { getBalanceSheetExtractionPrompt, validateBalanceSheetData, BALANCE_SHEET_FIELD_LABELS_VI } from '../balance-sheet'
import { getPayrollReportExtractionPrompt, validatePayrollReportData, PAYROLL_REPORT_FIELD_LABELS_VI } from '../payroll-report'
import { getDepreciationScheduleExtractionPrompt, validateDepreciationScheduleData, DEPRECIATION_SCHEDULE_FIELD_LABELS_VI } from '../depreciation-schedule'
import { getPensionStatementExtractionPrompt, validatePensionStatementData, PENSION_STATEMENT_FIELD_LABELS_VI } from '../pension-statement'
import { getIraStatementExtractionPrompt, validateIraStatementData, IRA_STATEMENT_FIELD_LABELS_VI } from '../ira-statement'
import { get401kStatementExtractionPrompt, validate401kStatementData, STATEMENT_401K_FIELD_LABELS_VI } from '../statement-401k'
import { getRothIraStatementExtractionPrompt, validateRothIraStatementData, ROTH_IRA_STATEMENT_FIELD_LABELS_VI } from '../roth-ira-statement'
import { getRmdStatementExtractionPrompt, validateRmdStatementData, RMD_STATEMENT_FIELD_LABELS_VI } from '../rmd-statement'
import { getHsaStatementExtractionPrompt, validateHsaStatementData, HSA_STATEMENT_FIELD_LABELS_VI } from '../hsa-statement'
import { getFsaStatementExtractionPrompt, validateFsaStatementData, FSA_STATEMENT_FIELD_LABELS_VI } from '../fsa-statement'
import { getDaycareStatementExtractionPrompt, validateDaycareStatementData, DAYCARE_STATEMENT_FIELD_LABELS_VI } from '../daycare-statement'
import { getDependentCareFsaExtractionPrompt, validateDependentCareFsaData, DEPENDENT_CARE_FSA_FIELD_LABELS_VI } from '../dependent-care-fsa'

// Forms use different validation patterns:
// Pattern A: 'key' in d - requires key to exist (even if null)
// Pattern B: stricter field + type checks
const forms = [
  {
    name: 'ITIN Letter',
    prompt: getItinLetterExtractionPrompt,
    validate: validateItinLetterData,
    labels: ITIN_LETTER_FIELD_LABELS_VI,
    validData: { recipientName: 'NGUYEN VAN A', itinNumber: null, issueDate: null, expirationDate: null },
    requiredFields: ['recipientName'],
  },
  {
    name: 'Pay Stub',
    prompt: getPayStubExtractionPrompt,
    validate: validatePayStubData,
    labels: PAY_STUB_FIELD_LABELS_VI,
    validData: { employeeName: 'John Doe', employerName: null, grossPay: 5000, netPay: 3800, payPeriodStart: null, payPeriodEnd: null, ytdGross: null, ytdFederalWithheld: null },
    requiredFields: ['employeeName'],
  },
  {
    name: 'Green Card',
    prompt: getGreenCardExtractionPrompt,
    validate: validateGreenCardData,
    labels: GREEN_CARD_FIELD_LABELS_VI,
    validData: { fullName: 'NGUYEN, VAN A', alienNumber: null, category: null, countryOfBirth: null, dateOfBirth: null, cardExpirationDate: null, residentSince: null },
    requiredFields: ['fullName'],
  },
  {
    name: 'Stock Option Agreement',
    prompt: getStockOptionAgreementExtractionPrompt,
    validate: validateStockOptionAgreementData,
    labels: STOCK_OPTION_AGREEMENT_FIELD_LABELS_VI,
    validData: { granteeName: 'Jane Smith', companyName: null, optionType: 'ISO', grantDate: null, totalOptionsGranted: 10000, exercisePrice: 25.50, vestingSchedule: null, expirationDate: null },
    requiredFields: ['granteeName'],
  },
  {
    name: 'RSU Statement',
    prompt: getRsuStatementExtractionPrompt,
    validate: validateRsuStatementData,
    labels: RSU_STATEMENT_FIELD_LABELS_VI,
    validData: { employeeName: 'John Doe', companyName: null, grantDate: null, totalUnitsGranted: 500, vestedUnits: 125, unvestedUnits: 375, grantPrice: null, currentPrice: null, vestingSchedule: null },
    requiredFields: ['employeeName'],
  },
  {
    name: 'Naturalization Certificate',
    prompt: getNaturalizationCertificateExtractionPrompt,
    validate: validateNaturalizationCertificateData,
    labels: NATURALIZATION_CERTIFICATE_FIELD_LABELS_VI,
    validData: { fullName: 'JOHN NGUYEN', certificateNumber: null, alienNumber: null, dateOfNaturalization: null, countryOfFormerNationality: null, dateOfBirth: null, placeOfBirth: null },
    requiredFields: ['fullName'],
  },
  {
    name: 'Brokerage Statement',
    prompt: getBrokerageStatementExtractionPrompt,
    validate: validateBrokerageStatementData,
    labels: BROKERAGE_STATEMENT_FIELD_LABELS_VI,
    validData: { accountHolderName: 'John Smith', brokerName: 'Fidelity Investments', accountNumber: null, statementPeriod: null, beginningBalance: 100000, endingBalance: 115000, totalDeposits: null, totalWithdrawals: null },
    requiredFields: ['accountHolderName', 'brokerName'],
  },
  {
    name: 'Property Tax Statement',
    prompt: getPropertyTaxStatementExtractionPrompt,
    validate: validatePropertyTaxStatementData,
    labels: PROPERTY_TAX_STATEMENT_FIELD_LABELS_VI,
    validData: { propertyAddress: '123 Main St, Los Angeles, CA 90001', ownerName: null, parcelNumber: null, assessedValue: 500000, taxRate: 1.1, annualTaxAmount: 5500, paymentStatus: 'PAID' },
    requiredFields: ['propertyAddress'],
  },
  {
    name: 'ESPP Statement',
    prompt: getEsppStatementExtractionPrompt,
    validate: validateEsppStatementData,
    labels: ESPP_STATEMENT_FIELD_LABELS_VI,
    validData: { employeeName: 'Jane Doe', companyName: null, purchaseDate: null, sharesPurchased: 100, purchasePrice: 45.00, fmvAtPurchase: 50.00, contributionAmount: null, discountPercentage: 15 },
    requiredFields: ['employeeName'],
  },
  {
    name: 'Work Visa',
    prompt: getWorkVisaExtractionPrompt,
    validate: validateWorkVisaData,
    labels: WORK_VISA_FIELD_LABELS_VI,
    validData: { fullName: 'NGUYEN VAN A', visaType: 'H-1B', validFrom: null, validUntil: null, nationality: null, employer: null, i94Number: null },
    requiredFields: ['fullName'],
  },
  {
    name: 'Marriage Certificate',
    prompt: getMarriageCertificateExtractionPrompt,
    validate: validateMarriageCertificateData,
    labels: MARRIAGE_CERTIFICATE_FIELD_LABELS_VI,
    validData: { spouse1Name: 'John Doe', spouse2Name: 'Jane Doe', dateOfMarriage: null, placeOfMarriage: null, certificateNumber: null },
    requiredFields: ['spouse1Name'],
  },
  {
    name: 'Divorce Decree',
    prompt: getDivorceDecreeExtractionPrompt,
    validate: validateDivorceDecreeData,
    labels: DIVORCE_DECREE_FIELD_LABELS_VI,
    validData: { petitionerName: 'John Doe', respondentName: 'Jane Doe', dateOfDivorce: null, caseNumber: null, courtName: null, alimonyAmount: null, childSupportAmount: null },
    requiredFields: ['petitionerName'],
  },
  {
    name: 'Power of Attorney',
    prompt: getPowerOfAttorneyExtractionPrompt,
    validate: validatePowerOfAttorneyData,
    labels: POWER_OF_ATTORNEY_FIELD_LABELS_VI,
    validData: { principalName: 'John Doe', agentName: 'Jane Doe', dateExecuted: null, scope: null, principalSSN: null },
    requiredFields: ['principalName'],
  },
  {
    name: 'Closing Disclosure',
    prompt: getClosingDisclosureExtractionPrompt,
    validate: validateClosingDisclosureData,
    labels: CLOSING_DISCLOSURE_FIELD_LABELS_VI,
    // Validator checks 'buyerName' in d
    validData: { buyerName: 'John Doe', propertyAddress: '456 Oak Rd', closingDate: null, purchasePrice: 450000, loanAmount: 360000, interestRate: null, monthlyPayment: null, mortgagePoints: null },
    requiredFields: ['buyerName'],
  },
  {
    name: 'HUD-1',
    prompt: getHud1ExtractionPrompt,
    validate: validateHud1Data,
    labels: HUD_1_FIELD_LABELS_VI,
    // Validator checks 'buyerName' in d
    validData: { buyerName: 'John Doe', sellerName: null, propertyAddress: null, settlementDate: null, grossAmountDueSeller: 450000, totalSettlementCharges: null, cashToClose: null },
    requiredFields: ['buyerName'],
  },
  {
    name: 'PMI Statement',
    prompt: getPmiStatementExtractionPrompt,
    validate: validatePmiStatementData,
    labels: PMI_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'propertyAddress' in d
    validData: { propertyAddress: '123 Main St', insurerName: null, annualPremium: 1800, monthlyPremium: null, totalPaidYTD: null },
    requiredFields: ['propertyAddress'],
  },
  {
    name: 'Mortgage Points Statement',
    prompt: getMortgagePointsStatementExtractionPrompt,
    validate: validateMortgagePointsStatementData,
    labels: MORTGAGE_POINTS_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'lenderName' in d
    validData: { lenderName: 'Chase Bank', propertyAddress: null, pointsAmount: 5400, loanAmount: null, originationDate: null },
    requiredFields: ['lenderName'],
  },
  {
    name: 'Estimated Tax Payment',
    prompt: getEstimatedTaxPaymentExtractionPrompt,
    validate: validateEstimatedTaxPaymentData,
    labels: ESTIMATED_TAX_PAYMENT_FIELD_LABELS_VI,
    validData: { taxpayerName: 'John Doe', paymentAmount: 5000, paymentDate: null, quarter: null, confirmationNumber: null, paymentMethod: null },
    requiredFields: ['taxpayerName'],
  },
  {
    name: 'Extension Payment Proof',
    prompt: getExtensionPaymentProofExtractionPrompt,
    validate: validateExtensionPaymentProofData,
    labels: EXTENSION_PAYMENT_PROOF_FIELD_LABELS_VI,
    validData: { taxpayerName: 'John Doe', paymentAmount: 2000, paymentDate: null, confirmationNumber: null, paymentMethod: null },
    requiredFields: ['taxpayerName'],
  },
  {
    name: 'Prior Year Return',
    prompt: getPriorYearReturnExtractionPrompt,
    validate: validatePriorYearReturnData,
    labels: PRIOR_YEAR_RETURN_FIELD_LABELS_VI,
    validData: { taxpayerName: 'John Doe', taxYear: 2023, adjustedGrossIncome: 85000, taxableIncome: null, totalTax: null, refundAmount: null },
    requiredFields: ['taxpayerName'],
  },
  {
    name: 'Crypto Tax Report',
    prompt: getCryptoTaxReportExtractionPrompt,
    validate: validateCryptoTaxReportData,
    labels: CRYPTO_TAX_REPORT_FIELD_LABELS_VI,
    // Validator checks 'taxpayerName' in d
    validData: { taxpayerName: 'John Doe', exchangeName: null, totalProceeds: 50000, totalCostBasis: 35000, netGainLoss: 15000, shortTermGainLoss: null, longTermGainLoss: null },
    requiredFields: ['taxpayerName'],
  },
  {
    name: 'Foreign Bank Statement',
    prompt: getForeignBankStatementExtractionPrompt,
    validate: validateForeignBankStatementData,
    labels: FOREIGN_BANK_STATEMENT_FIELD_LABELS_VI,
    validData: { accountHolderName: 'John Doe', bankName: null, country: null, currency: null, maxBalanceDuringYear: 50000, endingBalance: null },
    requiredFields: ['accountHolderName'],
  },
  {
    name: 'Foreign Tax Statement',
    prompt: getForeignTaxStatementExtractionPrompt,
    validate: validateForeignTaxStatementData,
    labels: FOREIGN_TAX_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'countryOfTax' in d
    validData: { countryOfTax: 'Japan', taxType: null, taxpayerName: 'John Doe', foreignTaxPaid: 8000, foreignIncome: null, currency: null, exchangeRate: null },
    requiredFields: ['countryOfTax'],
  },
  {
    name: 'Balance Sheet',
    prompt: getBalanceSheetExtractionPrompt,
    validate: validateBalanceSheetData,
    labels: BALANCE_SHEET_FIELD_LABELS_VI,
    validData: { businessName: 'Smith LLC', totalAssets: 500000, totalLiabilities: 200000, totalEquity: 300000, reportDate: null },
    requiredFields: ['businessName'],
  },
  {
    name: 'Payroll Report',
    prompt: getPayrollReportExtractionPrompt,
    validate: validatePayrollReportData,
    labels: PAYROLL_REPORT_FIELD_LABELS_VI,
    validData: { businessName: 'Smith LLC', reportPeriod: null, totalGrossPayroll: 150000, totalFederalWithheld: null, totalStateWithheld: null, totalSSWithheld: null, totalMedicareWithheld: null },
    requiredFields: ['businessName'],
  },
  {
    name: 'Depreciation Schedule',
    prompt: getDepreciationScheduleExtractionPrompt,
    validate: validateDepreciationScheduleData,
    labels: DEPRECIATION_SCHEDULE_FIELD_LABELS_VI,
    // Validator checks 'assets' in d && Array.isArray(d.assets)
    validData: { assets: [], businessName: 'Smith LLC', totalDepreciation: 15000, section179Deduction: null, taxYear: 2024 },
    requiredFields: ['assets'],
  },
  {
    name: 'Pension Statement',
    prompt: getPensionStatementExtractionPrompt,
    validate: validatePensionStatementData,
    labels: PENSION_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'participantName' in d AND 'planName' in d
    validData: { participantName: 'John Doe', planName: 'State Pension', planSponsor: null, accountBalance: null, monthlyBenefit: 2500, benefitStartDate: null, yearsOfService: null },
    requiredFields: ['participantName', 'planName'],
  },
  {
    name: 'IRA Statement',
    prompt: getIraStatementExtractionPrompt,
    validate: validateIraStatementData,
    labels: IRA_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'accountHolderName', 'custodianName', 'fairMarketValue' in d
    // Also checks d.taxYear !== null && typeof d.taxYear !== 'number' (undefined fails)
    validData: { accountHolderName: 'John Doe', custodianName: 'Fidelity', fairMarketValue: 250000, accountType: 'TRADITIONAL', contributions: null, distributions: null, taxYear: null },
    requiredFields: ['accountHolderName', 'custodianName', 'fairMarketValue'],
  },
  {
    name: '401k Statement',
    prompt: get401kStatementExtractionPrompt,
    validate: validate401kStatementData,
    labels: STATEMENT_401K_FIELD_LABELS_VI,
    // Validator checks 'participantName', 'planName', 'accountBalance' in d
    validData: { participantName: 'John Doe', planName: '401k Plan', accountBalance: 350000, employerName: null, employeeContributions: null, employerMatch: null, vestedBalance: null },
    requiredFields: ['participantName', 'planName', 'accountBalance'],
  },
  {
    name: 'Roth IRA Statement',
    prompt: getRothIraStatementExtractionPrompt,
    validate: validateRothIraStatementData,
    labels: ROTH_IRA_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'accountHolderName', 'custodianName', 'fairMarketValue' in d
    validData: { accountHolderName: 'John Doe', custodianName: 'Schwab', fairMarketValue: 120000, contributions: null, earnings: null, distributions: null, taxYear: null },
    requiredFields: ['accountHolderName', 'custodianName', 'fairMarketValue'],
  },
  {
    name: 'RMD Statement',
    prompt: getRmdStatementExtractionPrompt,
    validate: validateRmdStatementData,
    labels: RMD_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'accountHolder' in d, 'rmdAmount' in d, 'priorYearEndBalance' in d
    // Also checks d.divisorFactor !== null type guard (undefined trips it)
    validData: { accountHolder: 'John Doe', rmdAmount: 15000, priorYearEndBalance: 400000, divisorFactor: null, distributionDate: null, distributionsTaken: null },
    requiredFields: ['accountHolder', 'rmdAmount', 'priorYearEndBalance'],
  },
  {
    name: 'HSA Statement',
    prompt: getHsaStatementExtractionPrompt,
    validate: validateHsaStatementData,
    labels: HSA_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'accountHolderName', 'custodianName', 'endingBalance' in d
    // Also checks d.employeeContributions !== null type guard (undefined trips it)
    validData: { accountHolderName: 'John Doe', custodianName: 'HealthEquity', endingBalance: 8500, employeeContributions: null, contributions: null, distributions: null, employerContributions: null, taxYear: null },
    requiredFields: ['accountHolderName', 'custodianName', 'endingBalance'],
  },
  {
    name: 'FSA Statement',
    prompt: getFsaStatementExtractionPrompt,
    validate: validateFsaStatementData,
    labels: FSA_STATEMENT_FIELD_LABELS_VI,
    // Validator checks 'participantName', 'planName', 'annualElection' in d
    validData: { participantName: 'John Doe', planName: 'Health FSA', annualElection: 2850, amountUsed: null, remainingBalance: null, planYear: null, taxYear: null },
    requiredFields: ['participantName', 'planName', 'annualElection'],
  },
  {
    name: 'Daycare Statement',
    prompt: getDaycareStatementExtractionPrompt,
    validate: validateDaycareStatementData,
    labels: DAYCARE_STATEMENT_FIELD_LABELS_VI,
    validData: { providerName: 'ABC Daycare', providerTIN: null, childName: null, totalAmountPaid: 12000, providerAddress: null },
    requiredFields: ['providerName'],
  },
  {
    name: 'Dependent Care FSA',
    prompt: getDependentCareFsaExtractionPrompt,
    validate: validateDependentCareFsaData,
    labels: DEPENDENT_CARE_FSA_FIELD_LABELS_VI,
    validData: { participantName: 'John Doe', employerName: null, annualElection: 5000, amountUsed: null, remainingBalance: null, planYear: null },
    requiredFields: ['participantName'],
  },
]

// Prompt Generation
describe('Semi-Structured Docs - Prompt Generation', () => {
  forms.forEach(({ name, prompt }) => {
    it(`${name}: returns non-empty string with JSON`, () => {
      const result = prompt()
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(100)
      expect(result).toContain('JSON')
    })
  })
})

// Validation - Reject invalid inputs
describe('Semi-Structured Docs - Validation Rejects Invalid', () => {
  forms.forEach(({ name, validate }) => {
    it(`${name}: rejects null, undefined, non-object`, () => {
      expect(validate(null)).toBe(false)
      expect(validate(undefined)).toBe(false)
      expect(validate('string')).toBe(false)
      expect(validate(123)).toBe(false)
    })

    it(`${name}: rejects empty object`, () => {
      expect(validate({})).toBe(false)
    })
  })
})

// Validation - Accept valid data
describe('Semi-Structured Docs - Validation Accepts Valid Data', () => {
  forms.forEach(({ name, validate, validData }) => {
    it(`${name}: accepts well-formed data`, () => {
      expect(validate(validData)).toBe(true)
    })
  })
})

// Validation - Reject missing required fields
describe('Semi-Structured Docs - Validation Rejects Missing Required Fields', () => {
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

// Vietnamese Labels
describe('Semi-Structured Docs - Vietnamese Labels', () => {
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
