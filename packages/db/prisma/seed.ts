import { PrismaClient, TaxType, DocType } from '../src/generated/index.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding checklist templates...')

  // 1040 Templates - Individual Tax Return
  const form1040Templates = [
    { docType: DocType.SSN_CARD, labelVi: 'The SSN', labelEn: 'SSN Card', category: 'personal', sortOrder: 1 },
    { docType: DocType.DRIVER_LICENSE, labelVi: 'Bang Lai / ID', labelEn: 'Driver License / ID', category: 'personal', sortOrder: 2 },
    { docType: DocType.W2, labelVi: 'W2 (Thu nhap tu cong viec)', labelEn: 'W2 (Employment Income)', category: 'income', sortOrder: 10, condition: '{"hasW2": true}' },
    { docType: DocType.FORM_1099_INT, labelVi: '1099-INT (Lai ngan hang)', labelEn: '1099-INT (Bank Interest)', category: 'income', sortOrder: 11, isRequired: false },
    { docType: DocType.FORM_1099_DIV, labelVi: '1099-DIV (Co tuc)', labelEn: '1099-DIV (Dividends)', category: 'income', sortOrder: 12, condition: '{"hasInvestments": true}' },
    { docType: DocType.FORM_1099_NEC, labelVi: '1099-NEC (Thu nhap tu do)', labelEn: '1099-NEC (Self-Employment)', category: 'income', sortOrder: 13, condition: '{"hasSelfEmployment": true}' },
    { docType: DocType.FORM_1099_K, labelVi: '1099-K (Thu nhap the)', labelEn: '1099-K (Card Income)', category: 'income', sortOrder: 14, condition: '{"hasSelfEmployment": true}' },
    { docType: DocType.BANK_STATEMENT, labelVi: 'Sao ke ngan hang', labelEn: 'Bank Statement', category: 'income', sortOrder: 15, condition: '{"hasBankAccount": true}' },
    { docType: DocType.BIRTH_CERTIFICATE, labelVi: 'Giay khai sinh con', labelEn: 'Child Birth Certificate', category: 'dependents', sortOrder: 20, condition: '{"hasKidsUnder17": true}' },
    { docType: DocType.DAYCARE_RECEIPT, labelVi: 'Hoa don daycare', labelEn: 'Daycare Receipt', category: 'dependents', sortOrder: 21, condition: '{"paysDaycare": true}' },
    { docType: DocType.FORM_1098_T, labelVi: '1098-T (Hoc phi)', labelEn: '1098-T (Tuition)', category: 'dependents', sortOrder: 22, condition: '{"hasKids17to24": true}' },
    { docType: DocType.FORM_1098, labelVi: '1098 (Lai vay nha)', labelEn: '1098 (Mortgage Interest)', category: 'deductions', sortOrder: 30, isRequired: false },
  ]

  // 1120S Templates - S-Corp Tax Return
  const form1120STemplates = [
    { docType: DocType.EIN_LETTER, labelVi: 'Thu EIN', labelEn: 'EIN Letter', category: 'business', sortOrder: 1 },
    { docType: DocType.BUSINESS_LICENSE, labelVi: 'Giay phep kinh doanh', labelEn: 'Business License', category: 'business', sortOrder: 2 },
    { docType: DocType.BANK_STATEMENT, labelVi: 'Sao ke ngan hang (12 thang)', labelEn: 'Bank Statements (12 months)', category: 'business', sortOrder: 10 },
    { docType: DocType.PROFIT_LOSS_STATEMENT, labelVi: 'Bao cao loi lo', labelEn: 'Profit & Loss Statement', category: 'business', sortOrder: 11 },
    { docType: DocType.FORM_1099_K, labelVi: '1099-K (Thu nhap the)', labelEn: '1099-K (Card Income)', category: 'income', sortOrder: 20, condition: '{"has1099K": true}' },
    { docType: DocType.FORM_1099_NEC, labelVi: '1099-NEC (Da phat)', labelEn: '1099-NEC (Issued)', category: 'expenses', sortOrder: 30, condition: '{"hasContractors": true}' },
    { docType: DocType.W2, labelVi: 'W2 (Da phat cho nhan vien)', labelEn: 'W2 (Issued to Employees)', category: 'expenses', sortOrder: 31, condition: '{"hasEmployees": true}' },
  ]

  // 1065 Templates - Partnership Tax Return (similar to 1120S)
  const form1065Templates = [
    { docType: DocType.EIN_LETTER, labelVi: 'Thu EIN', labelEn: 'EIN Letter', category: 'business', sortOrder: 1 },
    { docType: DocType.BUSINESS_LICENSE, labelVi: 'Giay phep kinh doanh', labelEn: 'Business License', category: 'business', sortOrder: 2 },
    { docType: DocType.BANK_STATEMENT, labelVi: 'Sao ke ngan hang (12 thang)', labelEn: 'Bank Statements (12 months)', category: 'business', sortOrder: 10 },
    { docType: DocType.PROFIT_LOSS_STATEMENT, labelVi: 'Bao cao loi lo', labelEn: 'Profit & Loss Statement', category: 'business', sortOrder: 11 },
    { docType: DocType.FORM_1099_K, labelVi: '1099-K (Thu nhap the)', labelEn: '1099-K (Card Income)', category: 'income', sortOrder: 20, condition: '{"has1099K": true}' },
    { docType: DocType.FORM_1099_NEC, labelVi: '1099-NEC (Da phat)', labelEn: '1099-NEC (Issued)', category: 'expenses', sortOrder: 30, condition: '{"hasContractors": true}' },
  ]

  // M1: Wrap all operations in a transaction for atomicity
  await prisma.$transaction(async (tx) => {
    // Insert 1040 templates
    console.log('Inserting FORM_1040 templates...')
    for (const template of form1040Templates) {
      await tx.checklistTemplate.upsert({
        where: { taxType_docType: { taxType: TaxType.FORM_1040, docType: template.docType } },
        update: { ...template, isRequired: template.isRequired ?? true },
        create: { ...template, taxType: TaxType.FORM_1040, isRequired: template.isRequired ?? true },
      })
    }

    // Insert 1120S templates
    console.log('Inserting FORM_1120S templates...')
    for (const template of form1120STemplates) {
      await tx.checklistTemplate.upsert({
        where: { taxType_docType: { taxType: TaxType.FORM_1120S, docType: template.docType } },
        update: { ...template, isRequired: template.isRequired ?? true },
        create: { ...template, taxType: TaxType.FORM_1120S, isRequired: template.isRequired ?? true },
      })
    }

    // Insert 1065 templates
    console.log('Inserting FORM_1065 templates...')
    for (const template of form1065Templates) {
      await tx.checklistTemplate.upsert({
        where: { taxType_docType: { taxType: TaxType.FORM_1065, docType: template.docType } },
        update: { ...template, isRequired: template.isRequired ?? true },
        create: { ...template, taxType: TaxType.FORM_1065, isRequired: template.isRequired ?? true },
      })
    }
  })

  console.log('Seed completed!')
  console.log(`  - FORM_1040: ${form1040Templates.length} templates`)
  console.log(`  - FORM_1120S: ${form1120STemplates.length} templates`)
  console.log(`  - FORM_1065: ${form1065Templates.length} templates`)
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
