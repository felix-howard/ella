/**
 * Checklist Generator Service
 * Generates dynamic checklists based on client profile answers
 *
 * Phase 3: Updated to read from intakeAnswers JSON with fallback to legacy profile fields
 */
import { prisma } from '../lib/db'
import type { TaxType, ClientProfile, ChecklistTemplate, Prisma } from '@ella/db'

/**
 * Context for evaluating checklist conditions
 * Combines legacy profile fields with dynamic intakeAnswers
 */
interface ConditionContext {
  // Legacy profile fields (backward compatibility)
  profile: {
    hasW2?: boolean
    hasBankAccount?: boolean
    hasInvestments?: boolean
    hasKidsUnder17?: boolean
    numKidsUnder17?: number
    paysDaycare?: boolean
    hasKids17to24?: boolean
    hasSelfEmployment?: boolean
    hasRentalProperty?: boolean
    hasEmployees?: boolean
    hasContractors?: boolean
    has1099K?: boolean
  }
  // Dynamic intake answers (primary source)
  intakeAnswers: Record<string, unknown>
}

/**
 * Mapping of doc types to intake answer count keys
 */
const COUNT_MAPPINGS: Record<string, string> = {
  W2: 'w2Count',
  RENTAL_STATEMENT: 'rentalPropertyCount',
  SCHEDULE_K1: 'k1Count',
}

/** Max condition JSON size (10KB) to prevent DoS */
const MAX_CONDITION_SIZE = 10 * 1024

/** Default bank statement count (months) */
const BANK_STATEMENT_DEFAULT_COUNT = 12

/**
 * Generate checklist items for a tax case based on tax types and client profile
 */
export async function generateChecklist(
  caseId: string,
  taxTypes: TaxType[],
  profile: ClientProfile
): Promise<void> {
  // Build condition context from profile
  const context = buildConditionContext(profile)

  // Get templates for selected tax types
  const templates = await prisma.checklistTemplate.findMany({
    where: { taxType: { in: taxTypes } },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  })

  console.log(`[Checklist] Evaluating ${templates.length} templates for case ${caseId}`)

  const itemsToCreate: Prisma.ChecklistItemCreateManyInput[] = []

  for (const template of templates) {
    // Required items without condition → always include
    // Required items with condition → include if condition passes
    // Non-required items without condition → skip (no way to determine applicability)
    // Non-required items with condition → include only if condition passes
    const shouldInclude = template.isRequired
      ? template.condition === null || evaluateCondition(template.condition, context, template.id)
      : template.condition !== null && evaluateCondition(template.condition, context, template.id)

    if (shouldInclude) {
      const expectedCount = getExpectedCount(template, context.intakeAnswers)

      itemsToCreate.push({
        caseId,
        templateId: template.id,
        status: 'MISSING',
        expectedCount,
        receivedCount: 0,
      })
    }
  }

  // Batch insert with skip duplicates
  if (itemsToCreate.length > 0) {
    await prisma.checklistItem.createMany({
      data: itemsToCreate,
      skipDuplicates: true,
    })
  }

  console.log(`[Checklist] Created ${itemsToCreate.length} checklist items for case ${caseId}`)
}

/**
 * Evaluate a condition JSON string against context
 * Checks intakeAnswers first, then falls back to legacy profile fields
 */
function evaluateCondition(
  conditionJson: string | null,
  context: ConditionContext,
  templateId: string
): boolean {
  // No condition = always include
  if (!conditionJson) {
    return true
  }

  // Size limit check to prevent DoS
  if (conditionJson.length > MAX_CONDITION_SIZE) {
    console.error(`[Checklist] Condition too large for template ${templateId}: ${conditionJson.length} bytes`)
    return false
  }

  try {
    const conditions = JSON.parse(conditionJson) as Record<string, unknown>

    for (const [key, expectedValue] of Object.entries(conditions)) {
      // Check intakeAnswers first (primary source)
      let actualValue = context.intakeAnswers[key]

      // Fallback to legacy profile fields
      if (actualValue === undefined) {
        actualValue = context.profile[key as keyof typeof context.profile]
      }

      // Key not found in either source = condition not met
      if (actualValue === undefined) {
        console.log(
          `[Checklist] Condition key "${key}" not found for template ${templateId}. Skipping.`
        )
        return false
      }

      // Strict equality check
      if (actualValue !== expectedValue) {
        return false
      }
    }

    return true // All conditions matched
  } catch (error) {
    console.error(`[Checklist] Failed to parse condition for template ${templateId}:`, error)
    return false // Invalid JSON = skip
  }
}

/**
 * Determine expected document count based on intake answers
 */
function getExpectedCount(
  template: ChecklistTemplate,
  intakeAnswers: Record<string, unknown>
): number {
  // Check for count mapping based on doc type
  const countKey = COUNT_MAPPINGS[template.docType]
  if (countKey && typeof intakeAnswers[countKey] === 'number') {
    const count = intakeAnswers[countKey] as number
    if (count > 0) return count
  }

  // Bank statement default: 12 months
  if (template.docType === 'BANK_STATEMENT') {
    return BANK_STATEMENT_DEFAULT_COUNT
  }

  // Use template default or 1
  return template.expectedCount ?? 1
}

/**
 * Validate intakeAnswers is a plain object
 */
function parseIntakeAnswers(value: unknown): Record<string, unknown> {
  // Must be non-null object (not array, not primitive)
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return {}
  }
  return value as Record<string, unknown>
}

/**
 * Build condition context from client profile
 */
function buildConditionContext(profile: ClientProfile): ConditionContext {
  return {
    profile: {
      hasW2: profile.hasW2,
      hasBankAccount: profile.hasBankAccount,
      hasInvestments: profile.hasInvestments,
      hasKidsUnder17: profile.hasKidsUnder17,
      numKidsUnder17: profile.numKidsUnder17,
      paysDaycare: profile.paysDaycare,
      hasKids17to24: profile.hasKids17to24,
      hasSelfEmployment: profile.hasSelfEmployment,
      hasRentalProperty: profile.hasRentalProperty,
      hasEmployees: profile.hasEmployees,
      hasContractors: profile.hasContractors,
      has1099K: profile.has1099K,
    },
    intakeAnswers: parseIntakeAnswers(profile.intakeAnswers),
  }
}

/**
 * Refresh checklist for a case (e.g., when profile/intakeAnswers is updated)
 * Preserves items with documents, re-evaluates MISSING items
 */
export async function refreshChecklist(caseId: string): Promise<void> {
  // Get case with client profile including intakeAnswers
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: { include: { profile: true } },
    },
  })

  if (!taxCase?.client?.profile) {
    throw new Error(`Case ${caseId} not found or missing profile`)
  }

  // Delete only MISSING items (preserve items with documents)
  await prisma.checklistItem.deleteMany({
    where: {
      caseId,
      status: 'MISSING',
    },
  })

  // Regenerate with current profile + intakeAnswers
  await generateChecklist(
    caseId,
    taxCase.taxTypes as TaxType[],
    taxCase.client.profile
  )

  console.log(`[Checklist] Refreshed checklist for case ${caseId}`)
}
