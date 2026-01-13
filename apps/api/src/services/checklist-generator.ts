/**
 * Checklist Generator Service
 * Generates dynamic checklists based on client profile answers
 */
import { prisma } from '../lib/db'
import type { TaxType, ClientProfile } from '@ella/db'

interface ProfileConditions {
  hasW2?: boolean
  hasBankAccount?: boolean
  hasInvestments?: boolean
  hasKidsUnder17?: boolean
  paysDaycare?: boolean
  hasKids17to24?: boolean
  hasSelfEmployment?: boolean
  hasRentalProperty?: boolean
  hasEmployees?: boolean
  hasContractors?: boolean
  has1099K?: boolean
}

/**
 * Generate checklist items for a tax case based on tax types and client profile
 */
export async function generateChecklist(
  caseId: string,
  taxTypes: TaxType[],
  profile: ClientProfile
): Promise<void> {
  // Get templates for selected tax types
  const templates = await prisma.checklistTemplate.findMany({
    where: { taxType: { in: taxTypes } },
    orderBy: { sortOrder: 'asc' },
  })

  // Filter templates based on conditions
  const applicableTemplates = templates.filter((template) => {
    // Always include required items without conditions
    if (template.isRequired && !template.condition) {
      return true
    }

    // Skip non-required items without conditions
    if (!template.condition) {
      return false
    }

    // Parse and evaluate condition
    try {
      const condition = JSON.parse(template.condition) as ProfileConditions
      return evaluateCondition(condition, profile)
    } catch {
      // If condition parsing fails, include item if required
      return template.isRequired
    }
  })

  // Create checklist items
  const checklistData = applicableTemplates.map((template) => ({
    caseId,
    templateId: template.id,
    status: 'MISSING' as const,
    // Bank statements typically need 12 months
    expectedCount: template.docType === 'BANK_STATEMENT' ? 12 : 1,
    receivedCount: 0,
  }))

  // Insert all items, skip duplicates
  if (checklistData.length > 0) {
    await prisma.checklistItem.createMany({
      data: checklistData,
      skipDuplicates: true,
    })
  }
}

/**
 * Evaluate a condition object against client profile
 */
function evaluateCondition(
  condition: ProfileConditions,
  profile: ClientProfile
): boolean {
  return Object.entries(condition).every(([key, value]) => {
    const profileValue = (profile as unknown as Record<string, unknown>)[key]
    return profileValue === value
  })
}

/**
 * Refresh checklist for a case (e.g., when profile is updated)
 */
export async function refreshChecklist(caseId: string): Promise<void> {
  // Get case with client profile
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: { include: { profile: true } },
      checklistItems: true,
    },
  })

  if (!taxCase || !taxCase.client.profile) {
    return
  }

  // Don't remove items that already have documents - just filter them
  // (createMany with skipDuplicates in generateChecklist preserves existing items)

  // Delete only MISSING items
  await prisma.checklistItem.deleteMany({
    where: {
      caseId,
      status: 'MISSING',
    },
  })

  // Regenerate (createMany with skipDuplicates will preserve existing)
  await generateChecklist(
    caseId,
    taxCase.taxTypes as TaxType[],
    taxCase.client.profile
  )
}
