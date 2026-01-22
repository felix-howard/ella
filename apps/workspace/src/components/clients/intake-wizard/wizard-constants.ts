/**
 * Constants for Intake Wizard
 * Centralized magic numbers and configuration values
 */

// SSN formatting
export const FORMATTED_SSN_LENGTH = 11 // "123-45-6789"
export const SSN_DIGITS_LENGTH = 9

// IP PIN
export const IP_PIN_LENGTH = 6

// Dependent limits
export const MAX_DEPENDENTS = 10
export const MONTHS_IN_YEAR = 12

// Bank account
export const ROUTING_NUMBER_LENGTH = 9
export const MIN_ACCOUNT_NUMBER_LENGTH = 4
export const MAX_ACCOUNT_NUMBER_LENGTH = 17

// Date constraints
export const MIN_DOB_YEAR = '1900-01-01' // Reasonable historical limit for DOB

// Get today's date in YYYY-MM-DD format
export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]
}
