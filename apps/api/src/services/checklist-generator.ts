/**
 * Checklist Generator Service
 * Generates dynamic checklists based on client profile answers
 *
 * Phase 3: Updated to read from intakeAnswers JSON with fallback to legacy profile fields
 * Phase 01 Upgrade: Added compound AND/OR conditions, numeric operators, cascading cleanup
 */
import { prisma } from '../lib/db'
import type { TaxType, ClientProfile, TaxEngagement, ChecklistTemplate, Prisma } from '@ella/db'
import {
  isSimpleCondition,
  isCompoundCondition,
  isLegacyCondition,
  isValidOperator,
  type Condition,
  type SimpleCondition,
  type CompoundCondition,
  type ComparisonOperator,
} from '@ella/shared'

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
  // Method to get value from context (intakeAnswers first, fallback to profile)
  get: (key: string) => unknown
}

/**
 * Mapping of doc types to intake answer count keys
 * Phase 03: Added mappings for lease agreements, property tax, and 1099-NEC
 */
const COUNT_MAPPINGS: Record<string, string> = {
  W2: 'w2Count',
  RENTAL_STATEMENT: 'rentalPropertyCount',
  SCHEDULE_K1: 'k1Count',
  SCHEDULE_K1_1065: 'k1Count',
  SCHEDULE_K1_1120S: 'k1Count',
  SCHEDULE_K1_1041: 'k1Count',
  LEASE_AGREEMENT: 'rentalPropertyCount',
  PROPERTY_TAX_STATEMENT: 'rentalPropertyCount',
  FORM_1099_NEC: 'num1099NECReceived',
}

/** Max condition JSON size (10KB) to prevent DoS */
const MAX_CONDITION_SIZE = 10 * 1024

/** Default bank statement count (months) */
const BANK_STATEMENT_DEFAULT_COUNT = 12

/** Max recursion depth for compound conditions (prevent stack overflow) */
const MAX_CONDITION_DEPTH = 3

/**
 * Profile data type for checklist generation
 * Accepts either ClientProfile (legacy) or TaxEngagement (multi-year)
 * Both have the same profile fields so we use a union type
 */
type ProfileData = ClientProfile | TaxEngagement

/**
 * Generate checklist items for a tax case based on tax types and client profile
 * @param caseId - Tax case ID
 * @param taxTypes - Array of tax types for this case
 * @param profile - Profile data (ClientProfile or TaxEngagement)
 */
export async function generateChecklist(
  caseId: string,
  taxTypes: TaxType[],
  profile: ProfileData
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
 * Supports legacy flat, simple with operators, and compound AND/OR formats
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
    const condition = JSON.parse(conditionJson) as Condition

    // Evaluate with depth tracking
    return evaluateConditionRecursive(condition, context, templateId, 0)
  } catch (error) {
    console.error(`[Checklist] Failed to parse condition for template ${templateId}:`, error)
    return false // Invalid JSON = skip
  }
}

/**
 * Recursive condition evaluator with depth limit
 * Handles all three condition formats
 */
function evaluateConditionRecursive(
  condition: Condition,
  context: ConditionContext,
  templateId: string,
  depth: number
): boolean {
  // Depth limit check to prevent stack overflow
  if (depth > MAX_CONDITION_DEPTH) {
    console.error(`[Checklist] Condition depth exceeded (max ${MAX_CONDITION_DEPTH}) for template ${templateId}`)
    return false
  }

  // Handle compound conditions (AND/OR)
  if (isCompoundCondition(condition)) {
    return evaluateCompoundCondition(condition, context, templateId, depth)
  }

  // Handle simple conditions with operators
  if (isSimpleCondition(condition)) {
    return evaluateSimpleCondition(condition, context, templateId)
  }

  // Handle legacy flat conditions (implicit AND)
  if (isLegacyCondition(condition)) {
    return evaluateLegacyCondition(condition, context, templateId)
  }

  console.error(`[Checklist] Unknown condition format for template ${templateId}`)
  return false
}

/**
 * Evaluate compound AND/OR conditions
 */
function evaluateCompoundCondition(
  condition: CompoundCondition,
  context: ConditionContext,
  templateId: string,
  depth: number
): boolean {
  const { type, conditions } = condition

  if (!conditions || conditions.length === 0) {
    console.warn(`[Checklist] Empty conditions array for template ${templateId}`)
    return false
  }

  if (type === 'AND') {
    return conditions.every((c) => evaluateConditionRecursive(c, context, templateId, depth + 1))
  }

  if (type === 'OR') {
    return conditions.some((c) => evaluateConditionRecursive(c, context, templateId, depth + 1))
  }

  return false
}

/**
 * Evaluate simple condition with optional comparison operator
 */
function evaluateSimpleCondition(
  condition: SimpleCondition,
  context: ConditionContext,
  templateId: string
): boolean {
  const { key, value: expectedValue, operator = '===' } = condition

  // Validate operator
  if (!isValidOperator(operator)) {
    console.error(`[Checklist] Invalid operator "${operator}" for template ${templateId}`)
    return false
  }

  const actualValue = context.get(key)

  // Key not found = condition not met
  if (actualValue === undefined) {
    console.log(`[Checklist] Condition key "${key}" not found for template ${templateId}. Skipping.`)
    return false
  }

  return compare(actualValue, expectedValue, operator)
}

/**
 * Evaluate legacy flat conditions (implicit AND between all keys)
 */
function evaluateLegacyCondition(
  condition: Record<string, unknown>,
  context: ConditionContext,
  templateId: string
): boolean {
  for (const [key, expectedValue] of Object.entries(condition)) {
    const actualValue = context.get(key)

    // Key not found = condition not met
    if (actualValue === undefined) {
      console.log(`[Checklist] Condition key "${key}" not found for template ${templateId}. Skipping.`)
      return false
    }

    // Strict equality check for legacy format
    if (actualValue !== expectedValue) {
      return false
    }
  }

  return true // All conditions matched
}

/**
 * Compare two values using the specified operator
 */
function compare(actual: unknown, expected: unknown, operator: ComparisonOperator): boolean {
  switch (operator) {
    case '===':
      return actual === expected
    case '!==':
      return actual !== expected
    case '>':
      return typeof actual === 'number' && typeof expected === 'number' && actual > expected
    case '<':
      return typeof actual === 'number' && typeof expected === 'number' && actual < expected
    case '>=':
      return typeof actual === 'number' && typeof expected === 'number' && actual >= expected
    case '<=':
      return typeof actual === 'number' && typeof expected === 'number' && actual <= expected
    default:
      return false
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
 * Build condition context from client profile or engagement
 * Both ClientProfile and TaxEngagement have the same profile fields
 */
function buildConditionContext(profile: ProfileData): ConditionContext {
  const intakeAnswers = parseIntakeAnswers(profile.intakeAnswers)
  const legacyProfile = {
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
  }

  return {
    profile: legacyProfile,
    intakeAnswers,
    // Lookup: intakeAnswers first, then legacy profile
    get: (key: string): unknown => {
      if (key in intakeAnswers) {
        return intakeAnswers[key]
      }
      return legacyProfile[key as keyof typeof legacyProfile]
    },
  }
}

/**
 * Cascade cleanup when parent answer changes to false
 * Deletes dependent answers from intakeAnswers and MISSING checklist items
 * @param clientId - Client ID
 * @param changedKey - The key that changed to false
 * @param caseId - Optional case ID to update checklist
 */
export async function cascadeCleanupOnFalse(
  clientId: string,
  changedKey: string,
  caseId?: string
): Promise<{ deletedAnswers: string[]; deletedItems: number }> {
  // Get client profile
  const profile = await prisma.clientProfile.findUnique({
    where: { clientId },
  })

  if (!profile) {
    throw new Error(`Profile not found for client ${clientId}`)
  }

  const intakeAnswers = parseIntakeAnswers(profile.intakeAnswers)
  const deletedAnswers: string[] = []

  // Get intake questions to find dependencies
  const questions = await prisma.intakeQuestion.findMany({
    where: { isActive: true },
    select: { questionKey: true, condition: true },
  })

  // Find questions that depend on the changed key
  for (const question of questions) {
    if (!question.condition) continue

    try {
      const condition = JSON.parse(question.condition) as Record<string, unknown>

      // Check if condition references the changed key (legacy format: { key: value })
      if (changedKey in condition && intakeAnswers[question.questionKey] !== undefined) {
        deletedAnswers.push(question.questionKey)
        delete intakeAnswers[question.questionKey]
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Update profile with cleaned intakeAnswers
  if (deletedAnswers.length > 0) {
    await prisma.clientProfile.update({
      where: { clientId },
      data: { intakeAnswers: intakeAnswers as Prisma.InputJsonValue },
    })
    console.log(`[Checklist] Cascade cleanup: deleted answers [${deletedAnswers.join(', ')}] for client ${clientId}`)
  }

  // Delete MISSING checklist items with failed conditions if caseId provided
  let deletedItems = 0
  if (caseId) {
    const result = await refreshChecklistCascade(caseId)
    deletedItems = result.deleted
  }

  return { deletedAnswers, deletedItems }
}

/**
 * Refresh checklist with cascade - deletes MISSING items that no longer match conditions
 * @param caseId - Tax case ID
 */
async function refreshChecklistCascade(caseId: string): Promise<{ deleted: number }> {
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: { include: { profile: true } },
      checklistItems: {
        where: { status: 'MISSING' },
        include: { template: true },
      },
    },
  })

  if (!taxCase?.client?.profile) {
    return { deleted: 0 }
  }

  const context = buildConditionContext(taxCase.client.profile)
  const itemsToDelete: string[] = []

  // Check each MISSING item to see if its condition still passes
  for (const item of taxCase.checklistItems) {
    if (!item.template.condition) continue

    const passes = evaluateCondition(item.template.condition, context, item.templateId)
    if (!passes) {
      itemsToDelete.push(item.id)
    }
  }

  // Delete items that no longer match conditions
  if (itemsToDelete.length > 0) {
    await prisma.checklistItem.deleteMany({
      where: { id: { in: itemsToDelete } },
    })
    console.log(`[Checklist] Cascade deleted ${itemsToDelete.length} MISSING items for case ${caseId}`)
  }

  return { deleted: itemsToDelete.length }
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
