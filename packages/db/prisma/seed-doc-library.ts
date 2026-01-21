/**
 * Seed Document Type Library
 * Comprehensive document recognition library for staff
 * Includes aliases and keywords for AI classification
 */
import { PrismaClient } from '../src/generated/index.js'

const prisma = new PrismaClient()

interface DocTypeLibrarySeed {
  code: string
  labelVi: string
  labelEn: string
  descriptionVi?: string
  descriptionEn?: string
  category: string
  aliases: string[]
  keywords: string[]
  sortOrder: number
}

const docTypeLibrary: DocTypeLibrarySeed[] = [
  // ============================================
  // CATEGORY: PERSONAL / IDENTITY
  // ============================================
  {
    code: 'SSN_CARD',
    labelVi: 'The SSN',
    labelEn: 'Social Security Card',
    descriptionVi: 'The An Sinh Xa Hoi',
    descriptionEn: 'Social Security Administration card',
    category: 'personal',
    aliases: ['social security', 'ss card', 'ssn'],
    keywords: ['social', 'security', 'administration', 'xxx-xx-xxxx'],
    sortOrder: 1,
  },
  {
    code: 'DRIVER_LICENSE',
    labelVi: 'Bang lai xe',
    labelEn: 'Driver License',
    descriptionVi: 'Bang lai xe hoac ID co anh',
    descriptionEn: 'State-issued driver license or ID',
    category: 'personal',
    aliases: ['dl', 'id card', 'state id', 'license'],
    keywords: ['driver', 'license', 'dmv', 'state', 'dob', 'expires'],
    sortOrder: 2,
  },
  {
    code: 'PASSPORT',
    labelVi: 'Ho chieu',
    labelEn: 'Passport',
    category: 'personal',
    aliases: ['passport book', 'passport card'],
    keywords: ['passport', 'nationality', 'department of state'],
    sortOrder: 3,
  },
  {
    code: 'BIRTH_CERTIFICATE',
    labelVi: 'Giay khai sinh',
    labelEn: 'Birth Certificate',
    category: 'personal',
    aliases: ['birth cert', 'certificate of live birth'],
    keywords: ['birth', 'certificate', 'vital records', 'registrar'],
    sortOrder: 4,
  },
  {
    code: 'ITIN_LETTER',
    labelVi: 'Thu ITIN',
    labelEn: 'ITIN Letter',
    descriptionVi: 'Thu xac nhan ITIN tu IRS',
    descriptionEn: 'IRS ITIN assignment letter',
    category: 'personal',
    aliases: ['itin notice', 'cp565'],
    keywords: ['itin', 'individual taxpayer', '9xx-xx-xxxx', 'cp565'],
    sortOrder: 5,
  },

  // ============================================
  // CATEGORY: EMPLOYMENT INCOME
  // ============================================
  {
    code: 'W2',
    labelVi: 'W2',
    labelEn: 'Form W-2',
    descriptionVi: 'Bao cao thu nhap tu cong viec',
    descriptionEn: 'Wage and Tax Statement',
    category: 'income',
    aliases: ['w-2', 'wage statement'],
    keywords: ['w-2', 'wage', 'salary', 'federal income tax withheld', 'employer'],
    sortOrder: 10,
  },
  {
    code: 'W2G',
    labelVi: 'W2G',
    labelEn: 'Form W-2G',
    descriptionVi: 'Tien thang co bac',
    descriptionEn: 'Certain Gambling Winnings',
    category: 'income',
    aliases: ['gambling winnings'],
    keywords: ['w-2g', 'gambling', 'winnings', 'casino', 'lottery'],
    sortOrder: 11,
  },

  // ============================================
  // CATEGORY: 1099 SERIES
  // ============================================
  {
    code: 'FORM_1099_INT',
    labelVi: '1099-INT',
    labelEn: 'Form 1099-INT',
    descriptionVi: 'Lai ngan hang',
    descriptionEn: 'Interest Income',
    category: 'income',
    aliases: ['1099int', 'interest statement'],
    keywords: ['1099-int', 'interest', 'interest income', 'bank', 'savings'],
    sortOrder: 20,
  },
  {
    code: 'FORM_1099_DIV',
    labelVi: '1099-DIV',
    labelEn: 'Form 1099-DIV',
    descriptionVi: 'Co tuc',
    descriptionEn: 'Dividends and Distributions',
    category: 'income',
    aliases: ['1099div', 'dividend statement'],
    keywords: ['1099-div', 'dividend', 'capital gain', 'qualified dividends'],
    sortOrder: 21,
  },
  {
    code: 'FORM_1099_NEC',
    labelVi: '1099-NEC',
    labelEn: 'Form 1099-NEC',
    descriptionVi: 'Thu nhap tu hop dong lao dong',
    descriptionEn: 'Nonemployee Compensation',
    category: 'income',
    aliases: ['1099nec', 'contractor income', 'freelance'],
    keywords: ['1099-nec', 'nonemployee', 'compensation', 'contractor', 'self-employed'],
    sortOrder: 22,
  },
  {
    code: 'FORM_1099_MISC',
    labelVi: '1099-MISC',
    labelEn: 'Form 1099-MISC',
    descriptionVi: 'Thu nhap khac',
    descriptionEn: 'Miscellaneous Income',
    category: 'income',
    aliases: ['1099misc', 'miscellaneous'],
    keywords: ['1099-misc', 'miscellaneous', 'rent', 'royalties', 'prizes'],
    sortOrder: 23,
  },
  {
    code: 'FORM_1099_K',
    labelVi: '1099-K',
    labelEn: 'Form 1099-K',
    descriptionVi: 'Thu nhap qua the',
    descriptionEn: 'Payment Card Transactions',
    category: 'income',
    aliases: ['1099k', 'payment card', 'third party network'],
    keywords: ['1099-k', 'payment card', 'paypal', 'stripe', 'square', 'venmo'],
    sortOrder: 24,
  },
  {
    code: 'FORM_1099_R',
    labelVi: '1099-R',
    labelEn: 'Form 1099-R',
    descriptionVi: 'Phan phoi huu tri',
    descriptionEn: 'Retirement Distributions',
    category: 'income',
    aliases: ['1099r', 'retirement', 'pension distribution'],
    keywords: ['1099-r', 'distribution', 'ira', '401k', 'pension', 'annuity'],
    sortOrder: 25,
  },
  {
    code: 'FORM_1099_G',
    labelVi: '1099-G',
    labelEn: 'Form 1099-G',
    descriptionVi: 'Tien that nghiep hoac hoan thue state',
    descriptionEn: 'Unemployment or State Refund',
    category: 'income',
    aliases: ['1099g', 'unemployment', 'state refund'],
    keywords: ['1099-g', 'unemployment', 'state refund', 'government payments'],
    sortOrder: 26,
  },
  {
    code: 'FORM_1099_SSA',
    labelVi: 'SSA-1099',
    labelEn: 'Form SSA-1099',
    descriptionVi: 'Quyen loi Social Security',
    descriptionEn: 'Social Security Benefits',
    category: 'income',
    aliases: ['ssa1099', 'social security benefits'],
    keywords: ['ssa-1099', 'social security', 'benefits paid', 'ssa'],
    sortOrder: 27,
  },
  {
    code: 'FORM_1099_B',
    labelVi: '1099-B',
    labelEn: 'Form 1099-B',
    descriptionVi: 'Ban co phieu',
    descriptionEn: 'Broker and Barter Exchange',
    category: 'income',
    aliases: ['1099b', 'stock sales', 'brokerage statement'],
    keywords: ['1099-b', 'proceeds', 'stocks', 'shares', 'cost basis', 'broker'],
    sortOrder: 28,
  },
  {
    code: 'FORM_1099_S',
    labelVi: '1099-S',
    labelEn: 'Form 1099-S',
    descriptionVi: 'Ban bat dong san',
    descriptionEn: 'Real Estate Sales',
    category: 'income',
    aliases: ['1099s', 'real estate sale'],
    keywords: ['1099-s', 'real estate', 'proceeds', 'property sale', 'closing'],
    sortOrder: 29,
  },
  {
    code: 'FORM_1099_C',
    labelVi: '1099-C',
    labelEn: 'Form 1099-C',
    descriptionVi: 'Xoa no',
    descriptionEn: 'Cancellation of Debt',
    category: 'income',
    aliases: ['1099c', 'debt cancellation'],
    keywords: ['1099-c', 'canceled', 'debt', 'forgiveness', 'discharged'],
    sortOrder: 30,
  },
  {
    code: 'FORM_1099_SA',
    labelVi: '1099-SA',
    labelEn: 'Form 1099-SA',
    descriptionVi: 'Phan phoi HSA',
    descriptionEn: 'HSA Distributions',
    category: 'health',
    aliases: ['1099sa', 'hsa distribution'],
    keywords: ['1099-sa', 'hsa', 'health savings', 'distribution'],
    sortOrder: 31,
  },
  {
    code: 'FORM_1099_Q',
    labelVi: '1099-Q',
    labelEn: 'Form 1099-Q',
    descriptionVi: 'Phan phoi 529',
    descriptionEn: '529 Plan Distributions',
    category: 'education',
    aliases: ['1099q', '529 distribution'],
    keywords: ['1099-q', '529', 'education', 'qualified tuition'],
    sortOrder: 32,
  },

  // ============================================
  // CATEGORY: K-1 FORMS
  // ============================================
  {
    code: 'SCHEDULE_K1',
    labelVi: 'Schedule K-1',
    labelEn: 'Schedule K-1',
    descriptionVi: 'K-1 tong quat',
    descriptionEn: 'Partner/Shareholder share of income',
    category: 'income',
    aliases: ['k1', 'k-1'],
    keywords: ['schedule k-1', 'partner', 'shareholder', 'distributive share'],
    sortOrder: 40,
  },
  {
    code: 'SCHEDULE_K1_1065',
    labelVi: 'K-1 (1065)',
    labelEn: 'K-1 from 1065',
    descriptionVi: 'K-1 tu Partnership',
    descriptionEn: 'K-1 from Partnership',
    category: 'income',
    aliases: ['partnership k1', 'k1 1065'],
    keywords: ['k-1', '1065', 'partnership', 'partner share'],
    sortOrder: 41,
  },
  {
    code: 'SCHEDULE_K1_1120S',
    labelVi: 'K-1 (1120S)',
    labelEn: 'K-1 from 1120S',
    descriptionVi: 'K-1 tu S-Corp',
    descriptionEn: 'K-1 from S Corporation',
    category: 'income',
    aliases: ['scorp k1', 'k1 1120s'],
    keywords: ['k-1', '1120s', 's corporation', 'shareholder share'],
    sortOrder: 42,
  },
  {
    code: 'SCHEDULE_K1_1041',
    labelVi: 'K-1 (1041)',
    labelEn: 'K-1 from 1041',
    descriptionVi: 'K-1 tu Trust/Estate',
    descriptionEn: 'K-1 from Trust or Estate',
    category: 'income',
    aliases: ['trust k1', 'estate k1', 'k1 1041'],
    keywords: ['k-1', '1041', 'trust', 'estate', 'beneficiary'],
    sortOrder: 43,
  },

  // ============================================
  // CATEGORY: HEALTH INSURANCE
  // ============================================
  {
    code: 'FORM_1095_A',
    labelVi: '1095-A',
    labelEn: 'Form 1095-A',
    descriptionVi: 'Bao hiem Marketplace',
    descriptionEn: 'Health Insurance Marketplace Statement',
    category: 'health',
    aliases: ['1095a', 'marketplace statement', 'aca'],
    keywords: ['1095-a', 'marketplace', 'healthcare.gov', 'premium tax credit', 'aptc'],
    sortOrder: 50,
  },
  {
    code: 'FORM_1095_B',
    labelVi: '1095-B',
    labelEn: 'Form 1095-B',
    descriptionVi: 'Bao hiem suc khoe',
    descriptionEn: 'Health Coverage',
    category: 'health',
    aliases: ['1095b', 'health coverage'],
    keywords: ['1095-b', 'health coverage', 'minimum essential coverage'],
    sortOrder: 51,
  },
  {
    code: 'FORM_1095_C',
    labelVi: '1095-C',
    labelEn: 'Form 1095-C',
    descriptionVi: 'Bao hiem qua noi lam viec',
    descriptionEn: 'Employer-Provided Health Coverage',
    category: 'health',
    aliases: ['1095c', 'employer health'],
    keywords: ['1095-c', 'employer', 'health insurance offer', 'affordable coverage'],
    sortOrder: 52,
  },
  {
    code: 'FORM_5498_SA',
    labelVi: '5498-SA',
    labelEn: 'Form 5498-SA',
    descriptionVi: 'Dong gop HSA',
    descriptionEn: 'HSA Contributions',
    category: 'health',
    aliases: ['5498sa', 'hsa contribution'],
    keywords: ['5498-sa', 'hsa', 'contributions', 'health savings'],
    sortOrder: 53,
  },

  // ============================================
  // CATEGORY: EDUCATION
  // ============================================
  {
    code: 'FORM_1098_T',
    labelVi: '1098-T',
    labelEn: 'Form 1098-T',
    descriptionVi: 'Hoc phi',
    descriptionEn: 'Tuition Statement',
    category: 'education',
    aliases: ['1098t', 'tuition statement'],
    keywords: ['1098-t', 'tuition', 'qualified tuition', 'education', 'university', 'college'],
    sortOrder: 60,
  },
  {
    code: 'FORM_1098_E',
    labelVi: '1098-E',
    labelEn: 'Form 1098-E',
    descriptionVi: 'Lai vay sinh vien',
    descriptionEn: 'Student Loan Interest',
    category: 'education',
    aliases: ['1098e', 'student loan'],
    keywords: ['1098-e', 'student loan', 'interest paid', 'education loan'],
    sortOrder: 61,
  },

  // ============================================
  // CATEGORY: DEDUCTIONS
  // ============================================
  {
    code: 'FORM_1098',
    labelVi: '1098',
    labelEn: 'Form 1098',
    descriptionVi: 'Lai vay mua nha',
    descriptionEn: 'Mortgage Interest Statement',
    category: 'deductions',
    aliases: ['1098', 'mortgage statement'],
    keywords: ['1098', 'mortgage', 'interest', 'points', 'property tax'],
    sortOrder: 70,
  },
  {
    code: 'FORM_8332',
    labelVi: 'Form 8332',
    labelEn: 'Form 8332',
    descriptionVi: 'Chuyen quyen nguoi phu thuoc',
    descriptionEn: 'Release of Claim to Exemption',
    category: 'deductions',
    aliases: ['release claim', 'dependency release'],
    keywords: ['8332', 'release', 'exemption', 'custody', 'divorce'],
    sortOrder: 71,
  },
  {
    code: 'PROPERTY_TAX_STATEMENT',
    labelVi: 'Phieu thue bat dong san',
    labelEn: 'Property Tax Statement',
    category: 'deductions',
    aliases: ['property tax bill', 'real estate tax'],
    keywords: ['property tax', 'real estate', 'county', 'assessed value'],
    sortOrder: 72,
  },
  {
    code: 'CHARITY_RECEIPT',
    labelVi: 'Bien lai tu thien',
    labelEn: 'Charity Receipt',
    category: 'deductions',
    aliases: ['donation receipt', 'charitable contribution'],
    keywords: ['donation', 'charity', 'contribution', 'nonprofit', '501c3'],
    sortOrder: 73,
  },
  {
    code: 'MEDICAL_RECEIPT',
    labelVi: 'Hoa don y te',
    labelEn: 'Medical Receipt',
    category: 'deductions',
    aliases: ['medical bill', 'healthcare receipt'],
    keywords: ['medical', 'healthcare', 'doctor', 'hospital', 'prescription'],
    sortOrder: 74,
  },
  {
    code: 'DAYCARE_RECEIPT',
    labelVi: 'Bien lai daycare',
    labelEn: 'Daycare Receipt',
    category: 'deductions',
    aliases: ['childcare receipt', 'daycare statement'],
    keywords: ['daycare', 'childcare', 'provider', 'dependent care'],
    sortOrder: 75,
  },
  {
    code: 'ESTIMATED_TAX_PAYMENT',
    labelVi: 'Chung tu dong estimated tax',
    labelEn: 'Estimated Tax Payment',
    category: 'deductions',
    aliases: ['quarterly tax', 'estimated payment'],
    keywords: ['estimated tax', 'quarterly', '1040-es', 'voucher'],
    sortOrder: 76,
  },

  // ============================================
  // CATEGORY: BUSINESS DOCUMENTS
  // ============================================
  {
    code: 'BANK_STATEMENT',
    labelVi: 'Sao ke ngan hang',
    labelEn: 'Bank Statement',
    category: 'business',
    aliases: ['bank stmt', 'account statement'],
    keywords: ['bank', 'statement', 'checking', 'savings', 'balance', 'transactions'],
    sortOrder: 80,
  },
  {
    code: 'PROFIT_LOSS_STATEMENT',
    labelVi: 'Bao cao lai lo',
    labelEn: 'Profit & Loss Statement',
    category: 'business',
    aliases: ['p&l', 'income statement', 'pl statement'],
    keywords: ['profit', 'loss', 'income', 'expenses', 'revenue', 'net income'],
    sortOrder: 81,
  },
  {
    code: 'BALANCE_SHEET',
    labelVi: 'Bang can doi ke toan',
    labelEn: 'Balance Sheet',
    category: 'business',
    aliases: ['statement of financial position'],
    keywords: ['balance sheet', 'assets', 'liabilities', 'equity', 'financial position'],
    sortOrder: 82,
  },
  {
    code: 'BUSINESS_LICENSE',
    labelVi: 'Giay phep kinh doanh',
    labelEn: 'Business License',
    category: 'business',
    aliases: ['license', 'permit'],
    keywords: ['business license', 'permit', 'city', 'county', 'registration'],
    sortOrder: 83,
  },
  {
    code: 'EIN_LETTER',
    labelVi: 'Thu EIN',
    labelEn: 'EIN Letter',
    descriptionVi: 'Thu xac nhan EIN tu IRS (CP575)',
    descriptionEn: 'IRS EIN confirmation letter (CP575)',
    category: 'business',
    aliases: ['ein confirmation', 'cp575', 'ss-4 confirmation'],
    keywords: ['ein', 'employer identification', 'cp575', 'irs', 'ss-4'],
    sortOrder: 84,
  },
  {
    code: 'ARTICLES_OF_INCORPORATION',
    labelVi: 'Dieu le cong ty',
    labelEn: 'Articles of Incorporation',
    category: 'business',
    aliases: ['articles', 'certificate of incorporation', 'corp papers'],
    keywords: ['articles', 'incorporation', 'corporation', 'secretary of state'],
    sortOrder: 85,
  },
  {
    code: 'OPERATING_AGREEMENT',
    labelVi: 'Hop dong hoat dong',
    labelEn: 'Operating Agreement',
    category: 'business',
    aliases: ['llc agreement', 'partnership agreement', 'bylaws'],
    keywords: ['operating agreement', 'llc', 'partnership', 'members', 'ownership'],
    sortOrder: 86,
  },
  {
    code: 'PAYROLL_REPORT',
    labelVi: 'Bao cao luong',
    labelEn: 'Payroll Report',
    category: 'business',
    aliases: ['941', 'payroll summary', 'w-3'],
    keywords: ['payroll', '941', 'wages', 'withholding', 'fica', 'w-3'],
    sortOrder: 87,
  },
  {
    code: 'DEPRECIATION_SCHEDULE',
    labelVi: 'Bang khau hao',
    labelEn: 'Depreciation Schedule',
    category: 'business',
    aliases: ['asset depreciation', 'fixed asset schedule'],
    keywords: ['depreciation', 'assets', 'macrs', '179', 'basis', 'accumulated'],
    sortOrder: 88,
  },
  {
    code: 'VEHICLE_MILEAGE_LOG',
    labelVi: 'Nhat ky lai xe',
    labelEn: 'Vehicle Mileage Log',
    category: 'business',
    aliases: ['mileage log', 'car log', 'auto log'],
    keywords: ['mileage', 'vehicle', 'business use', 'miles', 'odometer'],
    sortOrder: 89,
  },
  {
    code: 'RECEIPT',
    labelVi: 'Bien lai',
    labelEn: 'Receipt',
    category: 'business',
    aliases: ['expense receipt', 'purchase receipt'],
    keywords: ['receipt', 'purchase', 'expense', 'payment'],
    sortOrder: 90,
  },

  // ============================================
  // CATEGORY: PRIOR YEAR / IRS
  // ============================================
  {
    code: 'PRIOR_YEAR_RETURN',
    labelVi: 'To khai nam truoc',
    labelEn: 'Prior Year Return',
    category: 'prior_year',
    aliases: ['last year return', 'previous return'],
    keywords: ['1040', 'tax return', 'prior year', 'last year', 'schedule'],
    sortOrder: 100,
  },
  {
    code: 'IRS_NOTICE',
    labelVi: 'Thu tu IRS',
    labelEn: 'IRS Notice',
    category: 'prior_year',
    aliases: ['irs letter', 'cp notice'],
    keywords: ['irs', 'notice', 'cp', 'letter', 'adjustment', 'balance due'],
    sortOrder: 101,
  },

  // ============================================
  // CATEGORY: CRYPTO
  // ============================================
  {
    code: 'CRYPTO_STATEMENT',
    labelVi: 'Bao cao crypto',
    labelEn: 'Crypto Statement',
    category: 'crypto',
    aliases: ['cryptocurrency', 'bitcoin', 'digital assets'],
    keywords: ['crypto', 'bitcoin', 'ethereum', 'coinbase', 'binance', 'digital asset'],
    sortOrder: 110,
  },

  // ============================================
  // CATEGORY: FOREIGN
  // ============================================
  {
    code: 'FOREIGN_BANK_STATEMENT',
    labelVi: 'Sao ke ngan hang nuoc ngoai',
    labelEn: 'Foreign Bank Statement',
    category: 'foreign',
    aliases: ['overseas bank', 'international account'],
    keywords: ['foreign', 'bank', 'fbar', 'overseas', 'international', 'account'],
    sortOrder: 120,
  },
  {
    code: 'FOREIGN_TAX_STATEMENT',
    labelVi: 'Chung tu thue nuoc ngoai',
    labelEn: 'Foreign Tax Statement',
    category: 'foreign',
    aliases: ['overseas tax', 'international tax'],
    keywords: ['foreign', 'tax', 'paid', 'overseas', 'credit', 'withholding'],
    sortOrder: 121,
  },

  // ============================================
  // CATEGORY: OTHER
  // ============================================
  {
    code: 'OTHER',
    labelVi: 'Khac',
    labelEn: 'Other Document',
    category: 'other',
    aliases: ['miscellaneous', 'other'],
    keywords: ['other', 'misc', 'document'],
    sortOrder: 200,
  },
  {
    code: 'UNKNOWN',
    labelVi: 'Chua xac dinh',
    labelEn: 'Unknown Document',
    category: 'other',
    aliases: ['unidentified', 'unclassified'],
    keywords: ['unknown', 'unidentified'],
    sortOrder: 201,
  },
]

export async function seedDocTypeLibrary(): Promise<void> {
  console.log('Seeding document type library...')

  for (const doc of docTypeLibrary) {
    await prisma.docTypeLibrary.upsert({
      where: { code: doc.code },
      update: {
        labelVi: doc.labelVi,
        labelEn: doc.labelEn,
        descriptionVi: doc.descriptionVi,
        descriptionEn: doc.descriptionEn,
        category: doc.category,
        aliases: doc.aliases,
        keywords: doc.keywords,
        sortOrder: doc.sortOrder,
        isActive: true,
      },
      create: {
        code: doc.code,
        labelVi: doc.labelVi,
        labelEn: doc.labelEn,
        descriptionVi: doc.descriptionVi,
        descriptionEn: doc.descriptionEn,
        category: doc.category,
        aliases: doc.aliases,
        keywords: doc.keywords,
        sortOrder: doc.sortOrder,
        isActive: true,
      },
    })
  }

  console.log(`Seeded ${docTypeLibrary.length} document types`)
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedDocTypeLibrary()
    .catch((e) => {
      console.error('Seed failed:', e)
      process.exit(1)
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
}
