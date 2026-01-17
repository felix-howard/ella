/**
 * Test Fixtures for AI Services
 * Mock data for testing OCR extraction and classification
 * Phase 5: Comprehensive test data for all document types
 */

// =============================================================================
// W2 FIXTURES
// =============================================================================
export const validW2Data = {
  employerEIN: '12-3456789',
  employerName: 'Acme Corporation',
  employerAddress: '123 Business Blvd, San Jose, CA 95110',
  controlNumber: 'W2-2024-001',
  employeeSSN: '123-45-6789',
  employeeName: 'NGUYEN VAN A',
  employeeAddress: '456 Home Street, San Jose, CA 95111',
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
  box12Codes: [
    { code: 'D', amount: 5000.0 },
    { code: 'DD', amount: 1200.0 },
  ],
  box13Flags: { statutoryEmployee: false, retirementPlan: true, thirdPartySickPay: false },
  box14Other: null,
  taxYear: 2024,
  formVariant: 'W-2' as const,
}

export const minimalW2Data = {
  employerEIN: '12-3456789',
  employerName: 'Test Corp',
  employeeSSN: '123-45-6789',
  employeeName: 'John Doe',
  wagesTipsOther: 50000,
  federalIncomeTaxWithheld: 5000,
  stateTaxInfo: [],
  localTaxInfo: [],
  box12Codes: [],
  box13Flags: { statutoryEmployee: false, retirementPlan: false, thirdPartySickPay: false },
}

// =============================================================================
// 1099-K FIXTURES
// =============================================================================
export const valid1099KData = {
  filerName: 'Square Inc',
  filerAddress: '1455 Market Street, San Francisco, CA 94103',
  filerTIN: '46-0869875',
  filerPhone: '1-855-700-6000',
  payeeName: 'ABC Nail Salon LLC',
  payeeAddress: '123 Main Street, San Jose, CA 95112',
  payeeTIN: '12-3456789',
  accountNumber: 'SQ-XXXX-1234',
  grossAmount: 85000.0,
  cardNotPresent: 5000.0,
  numberOfPaymentTransactions: 2500,
  federalIncomeTaxWithheld: null,
  monthlyAmounts: {
    january: 6500.0,
    february: 6200.0,
    march: 7100.0,
    april: 7300.0,
    may: 7500.0,
    june: 7800.0,
    july: 7400.0,
    august: 7600.0,
    september: 7200.0,
    october: 7000.0,
    november: 6800.0,
    december: 6600.0,
  },
  stateTaxInfo: [{ state: 'CA', stateId: 'CA-XXX-XXXX', stateGrossAmount: 85000.0 }],
  pseName: 'Square Inc',
  psePhone: '1-855-700-6000',
  transactionReportingType: 'PAYMENT_CARD' as const,
  corrected: false,
  taxYear: 2024,
}

// =============================================================================
// SCHEDULE K-1 FIXTURES
// =============================================================================
export const validScheduleK1Data = {
  partnershipName: 'ABC Partners LLC',
  partnershipAddress: '100 Partnership Lane, San Jose, CA 95113',
  partnershipEIN: '12-3456789',
  irsCenter: 'Ogden, UT',
  partnerName: 'NGUYEN THI B',
  partnerAddress: '456 Partner Street, San Jose, CA 95114',
  partnerSSN: '234-56-7890',
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
  netRentalRealEstateIncome: null,
  otherNetRentalIncome: null,
  guaranteedPayments: 12000.0,
  interestIncome: null,
  dividends: null,
  qualifiedDividends: null,
  royalties: null,
  netShortTermCapitalGain: null,
  netLongTermCapitalGain: 5000.0,
  collectibles28Gain: null,
  unrecaptured1250Gain: null,
  net1231Gain: null,
  otherIncome: 'A - 1,500',
  section179Deduction: null,
  otherDeductions: 'R - 2,000',
  selfEmploymentEarnings: 62000.0,
  beginningCapitalAccount: 100000.0,
  currentYearIncrease: 55000.0,
  currentYearDecrease: null,
  withdrawalsDistributions: 30000.0,
  endingCapitalAccount: 125000.0,
  taxYear: 2024,
  amended: false,
  formType: 'K-1_1065' as const,
}

// =============================================================================
// BANK STATEMENT FIXTURES
// =============================================================================
export const validBankStatementData = {
  bankName: 'Chase Bank',
  bankAddress: '100 Chase Plaza, San Francisco, CA 94111',
  accountNumber: '****1234',
  accountType: 'BUSINESS' as const,
  accountHolderName: 'ABC Nail Salon LLC',
  accountHolderAddress: '123 Main Street, San Jose, CA 95112',
  statementPeriodStart: '01/01/2024',
  statementPeriodEnd: '01/31/2024',
  beginningBalance: 15000.0,
  endingBalance: 18500.0,
  totalDeposits: 25000.0,
  totalWithdrawals: 21500.0,
  depositCount: 45,
  withdrawalCount: 38,
  largeDeposits: [
    { date: '01/15/2024', description: 'Square Inc Deposit', amount: 8500.0 },
    { date: '01/22/2024', description: 'Cash Deposit', amount: 5000.0 },
    { date: '01/29/2024', description: 'Clover Network Deposit', amount: 4200.0 },
  ],
  largeWithdrawals: [
    { date: '01/05/2024', description: 'Rent Payment', amount: 3500.0 },
    { date: '01/10/2024', description: 'Supply Purchase - Nail Art', amount: 2000.0 },
    { date: '01/15/2024', description: 'Utility Bill', amount: 450.0 },
  ],
  totalFees: 25.0,
  interestEarned: null,
  pageNumber: 1,
  totalPages: 3,
}

// =============================================================================
// 1099-DIV FIXTURES
// =============================================================================
export const valid1099DivData = {
  payerName: 'Vanguard Group',
  payerAddress: '100 Vanguard Blvd, Malvern, PA 19355',
  payerTIN: '23-1945930',
  recipientName: 'NGUYEN VAN C',
  recipientAddress: '789 Investor Lane, San Jose, CA 95115',
  recipientTIN: '345-67-8901',
  accountNumber: 'VG-XXXX-5678',
  totalOrdinaryDividends: 1500.0,
  qualifiedDividends: 1200.0,
  totalCapitalGainDistr: 500.0,
  unrecap1250Gain: null,
  section1202Gain: null,
  collectibles28Gain: null,
  section897OrdinaryDividends: null,
  section897CapitalGain: null,
  nondividendDistributions: null,
  federalIncomeTaxWithheld: null,
  section199ADividends: null,
  investmentExpenses: null,
  foreignTaxPaid: 25.0,
  foreignCountry: 'Various',
  cashLiquidationDistr: null,
  noncashLiquidationDistr: null,
  exemptInterestDividends: null,
  specifiedPABInterestDiv: null,
  stateTaxInfo: [],
  taxYear: 2024,
  corrected: false,
  fatcaFilingRequirement: false,
}

// =============================================================================
// 1099-R FIXTURES
// =============================================================================
export const valid1099RData = {
  payerName: 'Fidelity Investments',
  payerAddress: '100 Fidelity Way, Boston, MA 02210',
  payerTIN: '04-3523567',
  recipientName: 'TRAN VAN D',
  recipientAddress: '321 Retirement Ave, San Jose, CA 95116',
  recipientTIN: '456-78-9012',
  accountNumber: 'FID-XXXX-9012',
  grossDistribution: 25000.0,
  taxableAmount: 25000.0,
  taxableAmountNotDetermined: false,
  totalDistribution: true,
  capitalGain: null,
  federalIncomeTaxWithheld: 5000.0,
  employeeContributions: null,
  netUnrealizedAppreciation: null,
  distributionCodes: '7',
  otherAmount: null,
  yourPercentOfTotal: null,
  totalEmployeeContributions: null,
  firstYearOfRoth: null,
  iraSepSimple: true,
  stateTaxInfo: [
    { state: 'CA', stateId: 'CA-XXX-XXXX', stateDistribution: 25000.0, stateTaxWithheld: 1250.0 },
  ],
  localTaxInfo: [],
  taxYear: 2024,
  corrected: false,
  fatcaFilingRequirement: false,
}

// =============================================================================
// SSA-1099 FIXTURES
// =============================================================================
export const validSsa1099Data = {
  beneficiaryName: 'LE THI E',
  beneficiaryAddress: '555 Social Security Blvd, San Jose, CA 95117',
  beneficiarySSN: '567-89-0123',
  claimNumber: '567-89-0123-A',
  totalBenefitsPaid: 18000.0,
  benefitsRepaid: 0,
  netBenefits: 18000.0,
  voluntaryTaxWithheld: 1800.0,
  descriptionOfBenefits: 'RETIREMENT BENEFITS',
  medicarePremiums: 1980.0,
  taxYear: 2024,
  formType: 'SSA-1099' as const,
}

// =============================================================================
// 1098 FIXTURES
// =============================================================================
export const valid1098Data = {
  recipientName: 'ABC Mortgage Company',
  recipientAddress: '500 Bank Street, San Francisco, CA 94102',
  recipientTIN: '12-3456789',
  payerName: 'PHAM VAN F',
  payerAddress: '777 Homeowner Lane, San Jose, CA 95118',
  payerTIN: '678-90-1234',
  accountNumber: '1234567890',
  mortgageInterestReceived: 12500.0,
  outstandingMortgagePrincipal: 350000.0,
  mortgageOriginationDate: '03/15/2020',
  refundOfOverpaidInterest: null,
  mortgageInsurancePremiums: 1200.0,
  pointsPaidOnPurchase: null,
  propertyAddress: null,
  numberOfProperties: 1,
  otherInfo: null,
  acquisitionDate: '03/01/2020',
  propertyTax: 4500.0,
  taxYear: 2024,
  corrected: false,
}

// =============================================================================
// 1095-A FIXTURES
// =============================================================================
export const valid1095AData = {
  marketplaceName: 'Covered California',
  marketplaceId: 'CA',
  policyNumber: '12345678',
  policyStartDate: '01/01/2024',
  policyEndDate: '12/31/2024',
  recipientName: 'HOANG VAN G',
  recipientSSN: '789-01-2345',
  recipientAddress: '888 Healthcare Drive, San Jose, CA 95119',
  recipientDOB: '05/15/1975',
  spouseName: 'HOANG THI H',
  spouseSSN: '890-12-3456',
  spouseDOB: '08/20/1978',
  coveredIndividuals: [
    { name: 'HOANG VAN G', ssn: '789-01-2345', dob: '05/15/1975', coverageStartDate: '01/01/2024', coverageEndDate: '12/31/2024' },
    { name: 'HOANG THI H', ssn: '890-12-3456', dob: '08/20/1978', coverageStartDate: '01/01/2024', coverageEndDate: '12/31/2024' },
  ],
  monthlyData: [
    { month: 'January', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'February', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'March', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'April', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'May', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'June', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'July', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'August', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'September', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'October', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'November', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
    { month: 'December', enrollmentPremium: 800.0, slcsp: 900.0, advancePayment: 500.0 },
  ],
  annualEnrollmentPremium: 9600.0,
  annualSlcsp: 10800.0,
  annualAdvancePayment: 6000.0,
  taxYear: 2024,
  corrected: false,
}

// =============================================================================
// 1098-T FIXTURES
// =============================================================================
export const valid1098TData = {
  filerName: 'San Jose State University',
  filerAddress: '1 Washington Square, San Jose, CA 95192',
  filerTIN: '94-1153096',
  filerPhone: '408-924-1000',
  studentName: 'VO VAN I',
  studentAddress: '999 Student Way, San Jose, CA 95120',
  studentTIN: '901-23-4567',
  accountNumber: 'SJSU-2024-001',
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

// =============================================================================
// 1099-G FIXTURES
// =============================================================================
export const valid1099GData = {
  payerName: 'California Employment Development Department',
  payerAddress: '800 Capitol Mall, Sacramento, CA 95814',
  payerTIN: '68-0269274',
  payerPhone: '1-800-300-5616',
  recipientName: 'DANG VAN J',
  recipientAddress: '111 Unemployment Ave, San Jose, CA 95121',
  recipientTIN: '012-34-5678',
  accountNumber: 'EDD-2024-001',
  unemploymentCompensation: 15000.0,
  stateTaxRefund: null,
  taxRefundYear: null,
  federalIncomeTaxWithheld: 1500.0,
  rtaaPayments: null,
  taxableGrants: null,
  agriculturePayments: null,
  marketGain: false,
  stateTaxInfo: [{ state: 'CA', stateId: 'CA-EDD-XXXX', stateTaxWithheld: 750.0 }],
  taxYear: 2024,
  corrected: false,
}

// =============================================================================
// 1099-MISC FIXTURES
// =============================================================================
export const valid1099MiscData = {
  payerName: 'ABC Property Management LLC',
  payerAddress: '200 Property Lane, San Jose, CA 95122',
  payerTIN: '12-3456789',
  payerPhone: '408-555-0123',
  recipientName: 'BUI VAN K',
  recipientAddress: '222 Landlord Street, San Jose, CA 95123',
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

// =============================================================================
// SSN CARD FIXTURES
// =============================================================================
export const validSsnCardData = {
  fullName: 'NGUYEN VAN L',
  firstName: 'NGUYEN',
  middleName: 'VAN',
  lastName: 'L',
  ssn: '234-56-7890',
  cardType: 'REGULAR' as const,
  issuedBy: 'SOCIAL SECURITY',
}

// =============================================================================
// DRIVER LICENSE FIXTURES
// =============================================================================
export const validDriverLicenseData = {
  fullName: 'TRAN THI M',
  firstName: 'TRAN',
  middleName: 'THI',
  lastName: 'M',
  licenseNumber: 'D1234567',
  dateOfBirth: '03/15/1985',
  expirationDate: '03/15/2029',
  address: '333 License Road',
  city: 'San Jose',
  state: 'CA',
  zipCode: '95124',
  licenseClass: 'C',
  sex: 'F' as const,
  height: '5-04',
  weight: '125',
  eyeColor: 'BRN',
  restrictions: null,
  endorsements: null,
  documentDiscriminator: null,
  issuedDate: '03/15/2024',
  issuingState: 'CA',
}

// =============================================================================
// CLASSIFICATION FIXTURES
// =============================================================================
export const validClassificationResults = {
  w2: {
    docType: 'W2' as const,
    confidence: 0.92,
    reasoning: 'Clear W-2 form with visible title "Wage and Tax Statement", Box 1 wages, Box 2 federal tax withheld',
  },
  ssnCard: {
    docType: 'SSN_CARD' as const,
    confidence: 0.94,
    reasoning: 'Blue Social Security card format with visible SSN number and cardholder name',
  },
  form1099K: {
    docType: 'FORM_1099_K' as const,
    confidence: 0.91,
    reasoning: '1099-K form from Square showing payment card transactions, gross amount in Box 1a',
  },
  unknown: {
    docType: 'UNKNOWN' as const,
    confidence: 0.25,
    reasoning: 'Image too blurry to identify document type with confidence',
  },
}

// =============================================================================
// ERROR CASE FIXTURES
// =============================================================================
export const invalidDataFixtures = {
  missingRequiredField: {
    employerName: 'Test Corp',
    // Missing employerEIN and other required fields
  },
  wrongType: {
    grossAmount: '85000', // Should be number, not string
    stateTaxInfo: [],
    corrected: false,
  },
  invalidArrayField: {
    bankName: 'Chase',
    accountNumber: '1234',
    beginningBalance: 15000,
    endingBalance: 18500,
    largeDeposits: 'not an array',
    largeWithdrawals: [],
  },
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Creates a minimal valid fixture for a given document type
 */
export function getMinimalFixture(docType: string): Record<string, unknown> {
  const fixtures: Record<string, Record<string, unknown>> = {
    W2: minimalW2Data,
    FORM_1099_K: {
      filerName: 'Square',
      payeeName: 'Test',
      payeeTIN: '123456789',
      grossAmount: 50000,
      stateTaxInfo: [],
      monthlyAmounts: {},
      corrected: false,
    },
    FORM_1099_DIV: {
      payerName: 'Vanguard',
      recipientTIN: '123-45-6789',
      totalOrdinaryDividends: 1500,
      stateTaxInfo: [],
      corrected: false,
      fatcaFilingRequirement: false,
    },
    BANK_STATEMENT: {
      bankName: 'Chase',
      accountNumber: '****1234',
      beginningBalance: 15000,
      endingBalance: 18500,
      largeDeposits: [],
      largeWithdrawals: [],
    },
    SSN_CARD: {
      fullName: 'JOHN DOE',
      ssn: '123-45-6789',
    },
    DRIVER_LICENSE: {
      fullName: 'JOHN DOE',
      licenseNumber: 'D1234567',
      expirationDate: '01/15/2028',
      issuingState: 'CA',
    },
  }

  return fixtures[docType] || {}
}

/**
 * Gets full valid fixture for a given document type
 */
export function getValidFixture(docType: string): Record<string, unknown> | null {
  const fixtures: Record<string, Record<string, unknown>> = {
    W2: validW2Data,
    FORM_1099_K: valid1099KData,
    SCHEDULE_K1: validScheduleK1Data,
    BANK_STATEMENT: validBankStatementData,
    FORM_1099_DIV: valid1099DivData,
    FORM_1099_R: valid1099RData,
    FORM_1099_SSA: validSsa1099Data,
    FORM_1098: valid1098Data,
    FORM_1095_A: valid1095AData,
    FORM_1098_T: valid1098TData,
    FORM_1099_G: valid1099GData,
    FORM_1099_MISC: valid1099MiscData,
    SSN_CARD: validSsnCardData,
    DRIVER_LICENSE: validDriverLicenseData,
  }

  return fixtures[docType] || null
}
