/**
 * Condition Types for Checklist Template Evaluation
 *
 * Supports three formats:
 * 1. Legacy flat: { key: value } - implicit AND between all entries
 * 2. Simple: { key, value, operator? } - single condition with optional operator
 * 3. Compound: { type: 'AND' | 'OR', conditions: [...] } - nested logic
 *
 * Max nesting depth: 3 levels (enforced in evaluator)
 */

/** Comparison operators for numeric and equality checks */
export type ComparisonOperator = '===' | '!==' | '>' | '<' | '>=' | '<='

/**
 * Simple condition with optional operator
 * Examples:
 * - { key: 'hasW2', value: true } -> hasW2 === true
 * - { key: 'foreignBalance', value: 10000, operator: '>' } -> foreignBalance > 10000
 */
export interface SimpleCondition {
  key: string
  value: unknown
  operator?: ComparisonOperator
}

/**
 * Compound condition with AND/OR logic
 * Examples:
 * - { type: 'AND', conditions: [{ key: 'hasSelfEmployment', value: true }, { key: 'hasBusinessVehicle', value: true }] }
 * - { type: 'OR', conditions: [{ key: 'hasForeignIncome', value: true }, { key: 'hasForeignAccounts', value: true }] }
 */
export interface CompoundCondition {
  type: 'AND' | 'OR'
  conditions: Condition[]
}

/**
 * Legacy flat condition format
 * Example: { hasW2: true, hasSelfEmployment: true } -> implicit AND
 */
export type LegacyCondition = Record<string, unknown>

/**
 * Union of all condition formats
 */
export type Condition = SimpleCondition | CompoundCondition | LegacyCondition

/**
 * Type guard for SimpleCondition
 * Has 'key' and 'value' properties (not 'type')
 */
export function isSimpleCondition(condition: unknown): condition is SimpleCondition {
  if (typeof condition !== 'object' || condition === null) {
    return false
  }
  const obj = condition as Record<string, unknown>
  return (
    typeof obj.key === 'string' &&
    'value' in obj &&
    !('type' in obj)
  )
}

/**
 * Type guard for CompoundCondition
 * Has 'type' (AND/OR) and 'conditions' array
 */
export function isCompoundCondition(condition: unknown): condition is CompoundCondition {
  if (typeof condition !== 'object' || condition === null) {
    return false
  }
  const obj = condition as Record<string, unknown>
  return (
    (obj.type === 'AND' || obj.type === 'OR') &&
    Array.isArray(obj.conditions)
  )
}

/**
 * Type guard for LegacyCondition
 * Plain object without 'key' or 'type' properties
 */
export function isLegacyCondition(condition: unknown): condition is LegacyCondition {
  if (typeof condition !== 'object' || condition === null || Array.isArray(condition)) {
    return false
  }
  const obj = condition as Record<string, unknown>
  return !('key' in obj) && !('type' in obj)
}

/**
 * Validate operator is one of the allowed comparison operators
 */
export function isValidOperator(op: unknown): op is ComparisonOperator {
  return op === '===' || op === '!==' || op === '>' || op === '<' || op === '>=' || op === '<='
}

/**
 * Parse and validate condition JSON string
 * Returns null if invalid or exceeds max size
 * @param json - JSON string to parse
 * @param maxSize - Maximum allowed size in bytes (default 10KB)
 */
export function parseCondition(json: string | null, maxSize = 10 * 1024): Condition | null {
  if (!json) return null

  // Size limit check to prevent DoS
  if (json.length > maxSize) {
    console.error(`[Condition] JSON too large: ${json.length} bytes (max ${maxSize})`)
    return null
  }

  try {
    const parsed = JSON.parse(json) as unknown

    // Validate it's an object
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      console.error('[Condition] Invalid condition format: not an object')
      return null
    }

    return parsed as Condition
  } catch (error) {
    console.error('[Condition] Failed to parse JSON:', error)
    return null
  }
}
