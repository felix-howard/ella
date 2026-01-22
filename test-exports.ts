// Test crypto exports
import {
  encryptSSN,
  decryptSSN,
  maskSSN,
  formatSSN,
  isValidSSN,
  encryptSensitiveFields
} from './apps/workspace/src/lib/crypto'

// Test intake-form-config exports
import {
  SECTION_CONFIG,
  SECTION_ORDER,
  NON_EDITABLE_SECTIONS,
  FIELD_CONFIG,
  US_STATES_OPTIONS,
  RELATIONSHIP_OPTIONS,
  formatToFieldType,
  type FormatType,
  type FieldConfigItem
} from './apps/workspace/src/lib/intake-form-config'

// Type check - exports are accessible
const ssn = "123456789"
const config = SECTION_CONFIG.identity
const stateOptions = US_STATES_OPTIONS[0]

console.log('✓ All exports are accessible')
