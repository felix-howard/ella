/**
 * Schedule E Version History Service
 * Track changes between versions of rental property data
 */
import type { ScheduleEProperty, ScheduleEVersionHistoryEntry } from '@ella/shared'

// English labels for property fields (frontend handles i18n translation)
const FIELD_LABELS: Record<string, string> = {
  address: 'Address',
  propertyType: 'Property type',
  monthsRented: 'Months rented',
  fairRentalDays: 'Fair rental days',
  personalUseDays: 'Personal use days',
  rentsReceived: 'Rents received',
  insurance: 'Insurance',
  mortgageInterest: 'Mortgage interest',
  repairs: 'Repairs',
  taxes: 'Taxes',
  utilities: 'Utilities',
  managementFees: 'Management fees',
  cleaningMaintenance: 'Cleaning & maintenance',
  otherExpenses: 'Other expenses',
}

/**
 * Compare two addresses for equality
 */
function addressesEqual(
  a: { street: string; city: string; state: string; zip: string } | undefined,
  b: { street: string; city: string; state: string; zip: string } | undefined
): boolean {
  if (!a && !b) return true
  if (!a || !b) return false
  return (
    a.street === b.street &&
    a.city === b.city &&
    a.state === b.state &&
    a.zip === b.zip
  )
}

/**
 * Detect changes between two property objects
 */
function detectPropertyChanges(
  current: ScheduleEProperty,
  previous: ScheduleEProperty | undefined
): string[] {
  if (!previous) {
    return [`Added property ${current.id}`]
  }

  const changes: string[] = []
  const prefix = `[${current.id}]`

  if (!addressesEqual(current.address, previous.address)) {
    changes.push(`${prefix} Updated ${FIELD_LABELS.address}`)
  }

  const numericFields = [
    'propertyType',
    'monthsRented',
    'fairRentalDays',
    'personalUseDays',
    'rentsReceived',
    'insurance',
    'mortgageInterest',
    'repairs',
    'taxes',
    'utilities',
    'managementFees',
    'cleaningMaintenance',
  ] as const

  for (const field of numericFields) {
    const currentVal = current[field] ?? 0
    const previousVal = previous[field] ?? 0
    if (currentVal !== previousVal) {
      const label = FIELD_LABELS[field] || field
      changes.push(`${prefix} Updated ${label}`)
    }
  }

  // Compare other expenses
  const currentOther = current.otherExpenses || []
  const previousOther = previous.otherExpenses || []
  if (JSON.stringify(currentOther) !== JSON.stringify(previousOther)) {
    changes.push(`${prefix} Updated ${FIELD_LABELS.otherExpenses}`)
  }

  return changes
}

/**
 * Detect changes across all properties
 */
export function detectChanges(
  currentProperties: ScheduleEProperty[],
  previousProperties: ScheduleEProperty[]
): string[] {
  const changes: string[] = []

  // Build lookup for previous properties
  const previousMap = new Map<string, ScheduleEProperty>()
  for (const prop of previousProperties) {
    previousMap.set(prop.id, prop)
  }

  // Check current properties for changes/additions
  for (const current of currentProperties) {
    const previous = previousMap.get(current.id)
    const propertyChanges = detectPropertyChanges(current, previous)
    changes.push(...propertyChanges)
  }

  // Check for removed properties
  for (const previous of previousProperties) {
    const stillExists = currentProperties.some((p) => p.id === previous.id)
    if (!stillExists) {
      changes.push(`Removed property ${previous.id}`)
    }
  }

  return changes.length > 0 ? changes : ['No changes']
}

/**
 * Create a version history entry
 */
export function createVersionEntry(
  currentProperties: ScheduleEProperty[],
  previousProperties: ScheduleEProperty[],
  version: number
): ScheduleEVersionHistoryEntry {
  const changes = detectChanges(currentProperties, previousProperties)

  return {
    version,
    submittedAt: new Date().toISOString(),
    changes,
    properties: previousProperties, // Store the old version for audit
  }
}

/**
 * Parse version history from JSON field
 */
export function parseVersionHistory(
  versionHistory: unknown
): ScheduleEVersionHistoryEntry[] {
  if (!versionHistory) return []
  if (Array.isArray(versionHistory)) {
    return versionHistory as ScheduleEVersionHistoryEntry[]
  }
  if (typeof versionHistory === 'string') {
    try {
      return JSON.parse(versionHistory) as ScheduleEVersionHistoryEntry[]
    } catch {
      return []
    }
  }
  return []
}

/**
 * Add new version entry to history
 */
export function appendVersionHistory(
  existingHistory: unknown,
  newEntry: ScheduleEVersionHistoryEntry
): ScheduleEVersionHistoryEntry[] {
  const history = parseVersionHistory(existingHistory)
  history.push(newEntry)
  return history
}
