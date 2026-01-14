/**
 * Test Data Seed Script
 * Creates 5 sample clients with profiles, cases, magic links, and checklist items
 * Run: pnpm -F @ella/db seed:test
 */
import { PrismaClient, TaxType, TaxCaseStatus, Language, ChecklistItemStatus } from '../src/generated/index.js'

const prisma = new PrismaClient()

// Test clients data - varying profiles and statuses for comprehensive testing
const TEST_CLIENTS = [
  {
    name: 'Nguyen Van Test',
    phone: '+14155551001',
    email: 'test1@example.com',
    language: 'VI' as Language,
    profile: {
      filingStatus: 'MARRIED_JOINT',
      hasW2: true,
      hasBankAccount: true,
      hasInvestments: false,
      hasKidsUnder17: true,
      numKidsUnder17: 2,
      paysDaycare: true,
      hasKids17to24: false,
      hasSelfEmployment: false,
      hasRentalProperty: false,
      businessName: null,
      ein: null,
      hasEmployees: false,
      hasContractors: false,
      has1099K: false,
    },
    taxTypes: ['FORM_1040'] as TaxType[],
    status: 'INTAKE' as TaxCaseStatus,
  },
  {
    name: 'Tran Thi Demo',
    phone: '+14155551002',
    email: 'test2@example.com',
    language: 'VI' as Language,
    profile: {
      filingStatus: 'SINGLE',
      hasW2: true,
      hasBankAccount: true,
      hasInvestments: false,
      hasKidsUnder17: false,
      numKidsUnder17: 0,
      paysDaycare: false,
      hasKids17to24: false,
      hasSelfEmployment: true,
      hasRentalProperty: false,
      businessName: 'Tran Nail Art',
      ein: null,
      hasEmployees: false,
      hasContractors: true,
      has1099K: true,
    },
    taxTypes: ['FORM_1040', 'FORM_1065'] as TaxType[],
    status: 'WAITING_DOCS' as TaxCaseStatus,
  },
  {
    name: 'Le Hong Sample',
    phone: '+14155551003',
    email: null,
    language: 'EN' as Language,
    profile: {
      filingStatus: 'HEAD_OF_HOUSEHOLD',
      hasW2: true,
      hasBankAccount: true,
      hasInvestments: true,
      hasKidsUnder17: true,
      numKidsUnder17: 1,
      paysDaycare: false,
      hasKids17to24: true,
      hasSelfEmployment: false,
      hasRentalProperty: true,
      businessName: null,
      ein: null,
      hasEmployees: false,
      hasContractors: false,
      has1099K: false,
    },
    taxTypes: ['FORM_1040'] as TaxType[],
    status: 'IN_PROGRESS' as TaxCaseStatus,
  },
  {
    name: 'Pham Minh Example',
    phone: '+14155551004',
    email: 'test4@example.com',
    language: 'VI' as Language,
    profile: {
      filingStatus: 'MARRIED_JOINT',
      hasW2: false,
      hasBankAccount: true,
      hasInvestments: false,
      hasKidsUnder17: false,
      numKidsUnder17: 0,
      paysDaycare: false,
      hasKids17to24: false,
      hasSelfEmployment: true,
      hasRentalProperty: false,
      businessName: 'Pham Nail Salon LLC',
      ein: '12-3456789',
      hasEmployees: true,
      hasContractors: true,
      has1099K: true,
    },
    taxTypes: ['FORM_1040', 'FORM_1120S'] as TaxType[],
    status: 'READY_FOR_ENTRY' as TaxCaseStatus,
  },
  {
    name: 'Vo Thanh Review',
    phone: '+14155551005',
    email: 'test5@example.com',
    language: 'VI' as Language,
    profile: {
      filingStatus: 'SINGLE',
      hasW2: true,
      hasBankAccount: true,
      hasInvestments: false,
      hasKidsUnder17: false,
      numKidsUnder17: 0,
      paysDaycare: false,
      hasKids17to24: false,
      hasSelfEmployment: false,
      hasRentalProperty: false,
      businessName: null,
      ein: null,
      hasEmployees: false,
      hasContractors: false,
      has1099K: false,
    },
    taxTypes: ['FORM_1040'] as TaxType[],
    status: 'REVIEW' as TaxCaseStatus,
  },
]

async function seedTestData() {
  console.log('Starting test data seeding...\n')

  const currentYear = new Date().getFullYear()
  let createdCount = 0
  let skippedCount = 0

  for (const clientData of TEST_CLIENTS) {
    // Check if client exists by phone
    const existing = await prisma.client.findUnique({
      where: { phone: clientData.phone },
    })

    if (existing) {
      console.log(`⏭ Skipped (exists): ${clientData.name}`)
      skippedCount++
      continue
    }

    // Fetch templates first (outside transaction for read)
    const templates = await prisma.checklistTemplate.findMany({
      where: { taxType: { in: clientData.taxTypes } },
    })

    // Filter templates based on profile conditions
    const matchingTemplates = templates.filter((template) => {
      if (!template.condition) return true
      try {
        const condition = JSON.parse(template.condition)
        const profile = clientData.profile
        for (const [key, value] of Object.entries(condition)) {
          if (profile[key as keyof typeof profile] !== value) {
            return false
          }
        }
        return true
      } catch {
        return true // If condition parsing fails, include by default
      }
    })

    // Create client with profile, tax case, magic link, conversation, and checklist in single transaction
    const { checklistCount } = await prisma.$transaction(async (tx) => {
      // Create client with profile
      const newClient = await tx.client.create({
        data: {
          name: clientData.name,
          phone: clientData.phone,
          email: clientData.email,
          language: clientData.language,
          profile: {
            create: clientData.profile,
          },
        },
        include: { profile: true },
      })

      // Create tax case
      const taxCase = await tx.taxCase.create({
        data: {
          clientId: newClient.id,
          taxYear: currentYear,
          taxTypes: clientData.taxTypes,
          status: clientData.status,
        },
      })

      // Create magic link for the case
      await tx.magicLink.create({
        data: {
          caseId: taxCase.id,
          isActive: true,
        },
      })

      // Create conversation for the case
      await tx.conversation.create({
        data: { caseId: taxCase.id },
      })

      // Create checklist items in batch using createMany
      if (matchingTemplates.length > 0) {
        await tx.checklistItem.createMany({
          data: matchingTemplates.map((template) => ({
            caseId: taxCase.id,
            templateId: template.id,
            status: 'MISSING' as ChecklistItemStatus,
          })),
        })
      }

      return { client: newClient, taxCase, checklistCount: matchingTemplates.length }
    })

    console.log(`✓ Created: ${clientData.name} (${clientData.status}, ${checklistCount} checklist items)`)
    createdCount++
  }

  console.log('\n' + '='.repeat(50))
  console.log('Test data seeding complete!')
  console.log(`  Created: ${createdCount} clients`)
  console.log(`  Skipped: ${skippedCount} clients (already exist)`)
  console.log('='.repeat(50))
}

seedTestData()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
