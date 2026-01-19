/**
 * Seed Intake Questions
 * Dynamic questionnaire data extracted from CPA PDF guides
 */
import { PrismaClient, TaxType, FieldType } from '../src/generated/index.js'

const prisma = new PrismaClient()

interface IntakeQuestionSeed {
  questionKey: string
  taxTypes: TaxType[]
  labelVi: string
  labelEn: string
  hintVi?: string
  hintEn?: string
  fieldType: FieldType
  options?: string // JSON string
  condition?: string // JSON string
  section: string
  sortOrder: number
}

// ============================================
// FORM 1040 - INDIVIDUAL TAX RETURN QUESTIONS
// ============================================
const form1040Questions: IntakeQuestionSeed[] = [
  // Tax Info Section
  {
    questionKey: 'taxYear',
    taxTypes: [TaxType.FORM_1040, TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Năm thuế',
    labelEn: 'Tax Year',
    fieldType: FieldType.SELECT,
    options: JSON.stringify([
      { value: 2025, label: '2025' },
      { value: 2024, label: '2024' },
      { value: 2023, label: '2023' },
    ]),
    section: 'tax_info',
    sortOrder: 1,
  },
  {
    questionKey: 'filingStatus',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Tình trạng hôn nhân',
    labelEn: 'Filing Status',
    fieldType: FieldType.SELECT,
    options: JSON.stringify([
      { value: 'SINGLE', labelVi: 'Độc thân', labelEn: 'Single' },
      { value: 'MARRIED_FILING_JOINTLY', labelVi: 'Vợ chồng khai chung', labelEn: 'Married Filing Jointly' },
      { value: 'MARRIED_FILING_SEPARATELY', labelVi: 'Vợ chồng khai riêng', labelEn: 'Married Filing Separately' },
      { value: 'HEAD_OF_HOUSEHOLD', labelVi: 'Chủ hộ', labelEn: 'Head of Household' },
      { value: 'QUALIFYING_WIDOW', labelVi: 'Góa phụ có con', labelEn: 'Qualifying Surviving Spouse' },
    ]),
    section: 'tax_info',
    sortOrder: 2,
  },
  {
    questionKey: 'refundMethod',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Phương thức nhận tiền hoàn thuế',
    labelEn: 'Preferred Refund Method',
    fieldType: FieldType.SELECT,
    options: JSON.stringify([
      { value: 'DIRECT_DEPOSIT', labelVi: 'Direct Deposit', labelEn: 'Direct Deposit' },
      { value: 'CHECK', labelVi: 'Nhận check', labelEn: 'Paper Check' },
      { value: 'APPLY_NEXT_YEAR', labelVi: 'Áp dụng cho năm sau', labelEn: 'Apply to Next Year' },
    ]),
    section: 'tax_info',
    sortOrder: 3,
  },

  // Identity Section
  {
    questionKey: 'isNewClient',
    taxTypes: [TaxType.FORM_1040, TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Đây có phải là lần đầu bạn khai thuế với chúng tôi?',
    labelEn: 'Is this your first time filing with us?',
    hintVi: 'Nếu có, chúng tôi cần bản sao khai thuế năm trước',
    hintEn: 'If yes, we need a copy of prior year return',
    fieldType: FieldType.BOOLEAN,
    section: 'identity',
    sortOrder: 10,
  },
  {
    questionKey: 'hasIrsNotice',
    taxTypes: [TaxType.FORM_1040, TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có nhận được thư từ IRS trong năm không?',
    labelEn: 'Did you receive any IRS letters/notices?',
    fieldType: FieldType.BOOLEAN,
    section: 'identity',
    sortOrder: 11,
  },
  {
    questionKey: 'hasIdentityTheft',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có vấn đề về trộm cắp danh tính hoặc IRS PIN?',
    labelEn: 'Any identity theft issues or IRS PIN?',
    fieldType: FieldType.BOOLEAN,
    section: 'identity',
    sortOrder: 12,
  },

  // Life Changes Section
  {
    questionKey: 'hasAddressChange',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có thay đổi địa chỉ trong năm không?',
    labelEn: 'Did you move/change address in the year?',
    fieldType: FieldType.BOOLEAN,
    section: 'life_changes',
    sortOrder: 20,
  },
  {
    questionKey: 'hasMaritalChange',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có thay đổi tình trạng hôn nhân (kết hôn/ly hôn)?',
    labelEn: 'Any marital status change (married/divorced)?',
    fieldType: FieldType.BOOLEAN,
    section: 'life_changes',
    sortOrder: 21,
  },
  {
    questionKey: 'hasNewChild',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có con mới sinh, nhận nuôi trong năm không?',
    labelEn: 'Had a child / adopted / foster placement?',
    fieldType: FieldType.BOOLEAN,
    section: 'life_changes',
    sortOrder: 22,
  },
  {
    questionKey: 'hasBoughtSoldHome',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có mua/bán nhà trong năm không?',
    labelEn: 'Did you buy/sell a home?',
    fieldType: FieldType.BOOLEAN,
    section: 'life_changes',
    sortOrder: 23,
  },
  {
    questionKey: 'hasStartedBusiness',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có bắt đầu/kết thúc kinh doanh hoặc gig work không?',
    labelEn: 'Started/ended a business or gig work?',
    fieldType: FieldType.BOOLEAN,
    section: 'life_changes',
    sortOrder: 24,
  },

  // Income Section
  {
    questionKey: 'hasW2',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có W2 (thu nhập từ công việc)?',
    labelEn: 'Do you have W2 (employment income)?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 30,
  },
  {
    questionKey: 'hasW2G',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có W2G (tiền thắng cờ bạc)?',
    labelEn: 'Do you have W2G (gambling winnings)?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 31,
  },
  {
    questionKey: 'hasTipsIncome',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có thu nhập tips/tiền mặt không có trong W2?',
    labelEn: 'Any tips or cash income not on W2?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 32,
  },
  {
    questionKey: 'hasSelfEmployment',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có hoạt động tự kinh doanh?',
    labelEn: 'Do you have self-employment/gig income?',
    hintVi: 'Freelance, 1099-NEC, hoặc kinh doanh cá nhân',
    hintEn: 'Freelance, 1099-NEC, or sole proprietor business',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 33,
  },
  {
    questionKey: 'hasBankAccount',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có tài khoản ngân hàng tại Mỹ?',
    labelEn: 'Do you have a US bank account?',
    hintVi: 'Để nhận tiền hoàn thuế bằng Direct Deposit',
    hintEn: 'For direct deposit refund',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 34,
  },
  {
    questionKey: 'hasInvestments',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có đầu tư (cổ phiếu, crypto)?',
    labelEn: 'Do you have investments (stocks, crypto)?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 35,
  },
  {
    questionKey: 'hasCrypto',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có mua/bán/trao đổi digital assets (crypto)?',
    labelEn: 'Did you sell/exchange digital assets (crypto)?',
    condition: JSON.stringify({ hasInvestments: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 36,
  },
  {
    questionKey: 'hasRetirement',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận tiền từ IRA/pension/401k?',
    labelEn: 'Did you receive IRA/pension/401k distributions?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 37,
  },
  {
    questionKey: 'hasSocialSecurity',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận Social Security?',
    labelEn: 'Did you receive Social Security benefits?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 38,
  },
  {
    questionKey: 'hasUnemployment',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận tiền thất nghiệp?',
    labelEn: 'Did you receive unemployment compensation?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 39,
  },
  {
    questionKey: 'hasRentalProperty',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có thu nhập từ cho thuê nhà?',
    labelEn: 'Do you have rental property income?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 40,
  },
  {
    questionKey: 'hasK1Income',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận K-1 từ partnership/S-Corp/Trust?',
    labelEn: 'Did you receive K-1 from partnership/S-Corp/Trust?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 41,
  },
  {
    questionKey: 'hasAlimony',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận tiền cấp dưỡng (alimony)?',
    labelEn: 'Did you receive alimony?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 42,
  },

  // Dependents Section
  {
    questionKey: 'hasKidsUnder17',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có con dưới 17 tuổi?',
    labelEn: 'Do you have children under 17?',
    hintVi: 'Có thể được Child Tax Credit ($2,000/con)',
    hintEn: 'May qualify for Child Tax Credit ($2,000/child)',
    fieldType: FieldType.BOOLEAN,
    section: 'dependents',
    sortOrder: 50,
  },
  {
    questionKey: 'numKidsUnder17',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Số con dưới 17 tuổi',
    labelEn: 'Number of children under 17',
    condition: JSON.stringify({ hasKidsUnder17: true }),
    fieldType: FieldType.NUMBER,
    section: 'dependents',
    sortOrder: 51,
  },
  {
    questionKey: 'paysDaycare',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có trả tiền Daycare cho con?',
    labelEn: 'Did you pay for childcare/daycare?',
    hintVi: 'Có thể được Child and Dependent Care Credit',
    hintEn: 'May qualify for Child and Dependent Care Credit',
    condition: JSON.stringify({ hasKidsUnder17: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'dependents',
    sortOrder: 52,
  },
  {
    questionKey: 'hasKids17to24',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có con từ 17-24 tuổi đang đi học?',
    labelEn: 'Do you have children 17-24 in school?',
    hintVi: 'Có thể được American Opportunity Credit',
    hintEn: 'May qualify for American Opportunity Credit',
    fieldType: FieldType.BOOLEAN,
    section: 'dependents',
    sortOrder: 53,
  },
  {
    questionKey: 'hasOtherDependents',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có người phụ thuộc khác (cha mẹ già, etc)?',
    labelEn: 'Do you have other dependents (elderly parents, etc)?',
    fieldType: FieldType.BOOLEAN,
    section: 'dependents',
    sortOrder: 54,
  },

  // Health Insurance Section
  {
    questionKey: 'hasMarketplaceCoverage',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có bảo hiểm qua Marketplace (1095-A)?',
    labelEn: 'Did you have Marketplace health insurance (1095-A)?',
    fieldType: FieldType.BOOLEAN,
    section: 'health',
    sortOrder: 60,
  },
  {
    questionKey: 'hasHSA',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có tài khoản HSA?',
    labelEn: 'Do you have an HSA account?',
    fieldType: FieldType.BOOLEAN,
    section: 'health',
    sortOrder: 61,
  },

  // Deductions Section
  {
    questionKey: 'hasMortgage',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có vay mua nhà (mortgage)?',
    labelEn: 'Do you have a mortgage?',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 70,
  },
  {
    questionKey: 'hasPropertyTax',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có đóng thuế bất động sản (property tax)?',
    labelEn: 'Did you pay property taxes?',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 71,
  },
  {
    questionKey: 'hasCharitableDonations',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có đóng góp từ thiện?',
    labelEn: 'Did you make charitable donations?',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 72,
  },
  {
    questionKey: 'hasMedicalExpenses',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có chi phí y tế lớn?',
    labelEn: 'Did you have significant medical expenses?',
    hintVi: 'Chi phí không được bảo hiểm chi trả',
    hintEn: 'Out-of-pocket expenses not covered by insurance',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 73,
  },
  {
    questionKey: 'hasStudentLoanInterest',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có trả lãi student loan?',
    labelEn: 'Did you pay student loan interest?',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 74,
  },
  {
    questionKey: 'hasEducatorExpenses',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có phải là giáo viên và có chi phí classroom?',
    labelEn: 'Are you an educator with classroom expenses?',
    fieldType: FieldType.BOOLEAN,
    section: 'deductions',
    sortOrder: 75,
  },

  // Credits Section
  {
    questionKey: 'hasEnergyCredits',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có lắp đặt solar/pin/HVAC tiết kiệm năng lượng?',
    labelEn: 'Did you install solar/battery/energy-efficient HVAC?',
    fieldType: FieldType.BOOLEAN,
    section: 'credits',
    sortOrder: 80,
  },
  {
    questionKey: 'hasEVCredit',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có mua xe điện (EV) trong năm?',
    labelEn: 'Did you purchase an electric vehicle?',
    fieldType: FieldType.BOOLEAN,
    section: 'credits',
    sortOrder: 81,
  },
  {
    questionKey: 'hasAdoptionExpenses',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có chi phí nhận nuôi con?',
    labelEn: 'Did you have adoption expenses?',
    fieldType: FieldType.BOOLEAN,
    section: 'credits',
    sortOrder: 82,
  },

  // Foreign Section
  {
    questionKey: 'hasForeignAccounts',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có tài khoản ngân hàng/đầu tư ở nước ngoài?',
    labelEn: 'Do you have foreign bank/investment accounts?',
    hintVi: 'Có thể cần khai FBAR',
    hintEn: 'May need to file FBAR',
    fieldType: FieldType.BOOLEAN,
    section: 'foreign',
    sortOrder: 90,
  },
  {
    questionKey: 'hasForeignIncome',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có thu nhập từ nước ngoài?',
    labelEn: 'Did you have foreign income?',
    fieldType: FieldType.BOOLEAN,
    section: 'foreign',
    sortOrder: 91,
  },
  {
    questionKey: 'hasForeignTaxPaid',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có đóng thuế ở nước ngoài?',
    labelEn: 'Did you pay foreign taxes?',
    condition: JSON.stringify({ hasForeignIncome: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'foreign',
    sortOrder: 92,
  },

  // Business Section (conditional on hasSelfEmployment)
  {
    questionKey: 'businessName',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Tên doanh nghiệp',
    labelEn: 'Business Name',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.TEXT,
    section: 'business',
    sortOrder: 100,
  },
  {
    questionKey: 'ein',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'EIN (nếu có)',
    labelEn: 'EIN (if applicable)',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.TEXT,
    section: 'business',
    sortOrder: 101,
  },
  {
    questionKey: 'hasEmployees',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhân viên (W2)?',
    labelEn: 'Do you have employees (W2)?',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'business',
    sortOrder: 102,
  },
  {
    questionKey: 'hasContractors',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có trả cho contractors (1099-NEC)?',
    labelEn: 'Did you pay contractors (1099-NEC)?',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'business',
    sortOrder: 103,
  },
  {
    questionKey: 'has1099K',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có nhận thanh toán qua thẻ (1099-K)?',
    labelEn: 'Did you receive card payments (1099-K)?',
    hintVi: 'Stripe, Square, PayPal Business, etc.',
    hintEn: 'Stripe, Square, PayPal Business, etc.',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'business',
    sortOrder: 104,
  },
  {
    questionKey: 'hasHomeOffice',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có home office?',
    labelEn: 'Do you have a home office?',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'business',
    sortOrder: 105,
  },
  {
    questionKey: 'hasBusinessVehicle',
    taxTypes: [TaxType.FORM_1040],
    labelVi: 'Có sử dụng xe cho công việc?',
    labelEn: 'Do you use a vehicle for business?',
    condition: JSON.stringify({ hasSelfEmployment: true }),
    fieldType: FieldType.BOOLEAN,
    section: 'business',
    sortOrder: 106,
  },
]

// ============================================
// FORM 1120-S & 1065 - BUSINESS RETURN QUESTIONS
// ============================================
const businessQuestions: IntakeQuestionSeed[] = [
  // Entity Info
  {
    questionKey: 'entityName',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Tên pháp lý của doanh nghiệp',
    labelEn: 'Legal Entity Name',
    fieldType: FieldType.TEXT,
    section: 'entity_info',
    sortOrder: 1,
  },
  {
    questionKey: 'entityEIN',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'EIN',
    labelEn: 'EIN (Employer Identification Number)',
    fieldType: FieldType.TEXT,
    section: 'entity_info',
    sortOrder: 2,
  },
  {
    questionKey: 'stateOfFormation',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Tiểu bang thành lập',
    labelEn: 'State of Formation',
    fieldType: FieldType.TEXT,
    section: 'entity_info',
    sortOrder: 3,
  },
  {
    questionKey: 'accountingMethod',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Phương pháp kế toán',
    labelEn: 'Accounting Method',
    fieldType: FieldType.SELECT,
    options: JSON.stringify([
      { value: 'CASH', labelVi: 'Cash', labelEn: 'Cash' },
      { value: 'ACCRUAL', labelVi: 'Accrual', labelEn: 'Accrual' },
      { value: 'OTHER', labelVi: 'Khác', labelEn: 'Other' },
    ]),
    section: 'entity_info',
    sortOrder: 4,
  },
  {
    questionKey: 'returnType',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Loại tờ khai',
    labelEn: 'Return Type',
    fieldType: FieldType.SELECT,
    options: JSON.stringify([
      { value: 'ORIGINAL', labelVi: 'Original', labelEn: 'Original' },
      { value: 'AMENDED', labelVi: 'Amended', labelEn: 'Amended' },
      { value: 'FINAL', labelVi: 'Final', labelEn: 'Final' },
    ]),
    section: 'entity_info',
    sortOrder: 5,
  },

  // Ownership
  {
    questionKey: 'hasOwnershipChanges',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có thay đổi ownership trong năm?',
    labelEn: 'Any ownership changes during the year?',
    fieldType: FieldType.BOOLEAN,
    section: 'ownership',
    sortOrder: 10,
  },
  {
    questionKey: 'hasNonresidentOwners',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có shareholders/partners không cư trú tại Mỹ?',
    labelEn: 'Any nonresident shareholders/partners?',
    fieldType: FieldType.BOOLEAN,
    section: 'ownership',
    sortOrder: 11,
  },
  {
    questionKey: 'hasDistributions',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có phân phối (distributions) cho owners trong năm?',
    labelEn: 'Any distributions to owners during the year?',
    fieldType: FieldType.BOOLEAN,
    section: 'ownership',
    sortOrder: 12,
  },
  {
    questionKey: 'hasOwnerLoans',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có loans to/from owners?',
    labelEn: 'Any loans to/from owners?',
    fieldType: FieldType.BOOLEAN,
    section: 'ownership',
    sortOrder: 13,
  },

  // Income
  {
    questionKey: 'hasGrossReceipts',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có doanh thu (gross receipts)?',
    labelEn: 'Do you have gross receipts/sales?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 20,
  },
  {
    questionKey: 'businessHas1099K',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có nhận 1099-K (card payments)?',
    labelEn: 'Did you receive 1099-K (card payments)?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 21,
  },
  {
    questionKey: 'businessHas1099NEC',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có nhận 1099-NEC/MISC?',
    labelEn: 'Did you receive 1099-NEC/MISC?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 22,
  },
  {
    questionKey: 'hasInterestIncome',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có thu nhập từ lãi (interest)?',
    labelEn: 'Do you have interest income?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 23,
  },
  {
    questionKey: 'businessHasRentalIncome',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có thu nhập từ cho thuê?',
    labelEn: 'Do you have rental income?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 24,
  },
  {
    questionKey: 'hasInventory',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có hàng tồn kho (inventory)?',
    labelEn: 'Do you have inventory?',
    fieldType: FieldType.BOOLEAN,
    section: 'income',
    sortOrder: 25,
  },

  // Expenses
  {
    questionKey: 'businessHasEmployees',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có nhân viên?',
    labelEn: 'Do you have employees?',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 30,
  },
  {
    questionKey: 'businessHasContractors',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có trả cho contractors?',
    labelEn: 'Did you pay contractors?',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 31,
  },
  {
    questionKey: 'hasOfficerCompensation',
    taxTypes: [TaxType.FORM_1120S],
    labelVi: 'Có trả lương cho officers (shareholders)?',
    labelEn: 'Did you pay officer compensation?',
    hintVi: 'S-Corp phải trả reasonable compensation cho shareholders làm việc',
    hintEn: 'S-Corps must pay reasonable compensation to working shareholders',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 32,
  },
  {
    questionKey: 'hasGuaranteedPayments',
    taxTypes: [TaxType.FORM_1065],
    labelVi: 'Có guaranteed payments cho partners?',
    labelEn: 'Any guaranteed payments to partners?',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 33,
  },
  {
    questionKey: 'hasRetirementPlan',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có retirement plan cho nhân viên?',
    labelEn: 'Do you have a retirement plan for employees?',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 34,
  },
  {
    questionKey: 'hasHealthInsuranceOwners',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Công ty có trả bảo hiểm sức khỏe cho owners?',
    labelEn: 'Does the company pay health insurance for owners?',
    fieldType: FieldType.BOOLEAN,
    section: 'expenses',
    sortOrder: 35,
  },

  // Assets
  {
    questionKey: 'hasAssetPurchases',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có mua tài sản cố định trong năm?',
    labelEn: 'Any fixed asset purchases during the year?',
    fieldType: FieldType.BOOLEAN,
    section: 'assets',
    sortOrder: 40,
  },
  {
    questionKey: 'hasAssetDisposals',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có bán/thanh lý tài sản trong năm?',
    labelEn: 'Any asset sales/disposals during the year?',
    fieldType: FieldType.BOOLEAN,
    section: 'assets',
    sortOrder: 41,
  },
  {
    questionKey: 'hasDepreciation',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có tài sản cần tính khấu hao?',
    labelEn: 'Do you have depreciable assets?',
    fieldType: FieldType.BOOLEAN,
    section: 'assets',
    sortOrder: 42,
  },
  {
    questionKey: 'hasVehicles',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có xe công ty hoặc sử dụng xe cho kinh doanh?',
    labelEn: 'Any company vehicles or business use of vehicles?',
    fieldType: FieldType.BOOLEAN,
    section: 'assets',
    sortOrder: 43,
  },

  // State
  {
    questionKey: 'statesWithNexus',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Các tiểu bang có hoạt động kinh doanh',
    labelEn: 'States where business operates/has nexus',
    fieldType: FieldType.TEXT,
    section: 'state',
    sortOrder: 50,
  },
  {
    questionKey: 'hasMultistateIncome',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có thu nhập ở nhiều tiểu bang?',
    labelEn: 'Do you have income in multiple states?',
    fieldType: FieldType.BOOLEAN,
    section: 'state',
    sortOrder: 51,
  },

  // Foreign
  {
    questionKey: 'businessHasForeignActivity',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có hoạt động/tài sản ở nước ngoài?',
    labelEn: 'Any foreign activities or assets?',
    fieldType: FieldType.BOOLEAN,
    section: 'foreign',
    sortOrder: 60,
  },
  {
    questionKey: 'hasForeignOwners',
    taxTypes: [TaxType.FORM_1120S, TaxType.FORM_1065],
    labelVi: 'Có owners/partners ở nước ngoài?',
    labelEn: 'Any foreign owners/partners?',
    fieldType: FieldType.BOOLEAN,
    section: 'foreign',
    sortOrder: 61,
  },
]

// Combine all questions
const allQuestions = [...form1040Questions, ...businessQuestions]

export async function seedIntakeQuestions(): Promise<void> {
  console.log('Seeding intake questions...')

  for (const question of allQuestions) {
    await prisma.intakeQuestion.upsert({
      where: { questionKey: question.questionKey },
      update: {
        taxTypes: question.taxTypes,
        labelVi: question.labelVi,
        labelEn: question.labelEn,
        hintVi: question.hintVi,
        hintEn: question.hintEn,
        fieldType: question.fieldType,
        options: question.options,
        condition: question.condition,
        section: question.section,
        sortOrder: question.sortOrder,
        isActive: true,
      },
      create: {
        questionKey: question.questionKey,
        taxTypes: question.taxTypes,
        labelVi: question.labelVi,
        labelEn: question.labelEn,
        hintVi: question.hintVi,
        hintEn: question.hintEn,
        fieldType: question.fieldType,
        options: question.options,
        condition: question.condition,
        section: question.section,
        sortOrder: question.sortOrder,
        isActive: true,
      },
    })
  }

  console.log(`Seeded ${allQuestions.length} intake questions`)
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedIntakeQuestions()
    .catch((e) => {
      console.error('Seed failed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
