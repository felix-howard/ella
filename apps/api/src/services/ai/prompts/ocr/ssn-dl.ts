/**
 * SSN Card & Driver's License OCR Extraction Prompts
 * Extracts identity document data for tax client verification
 */

// ============================================
// SSN CARD TYPES AND PROMPTS
// ============================================

/**
 * SSN Card extracted data structure
 */
export interface SsnCardExtractedData {
  // Name on card
  fullName: string | null
  firstName: string | null
  middleName: string | null
  lastName: string | null

  // SSN
  ssn: string | null // Format: XXX-XX-XXXX

  // Card details
  cardType: 'REGULAR' | 'NOT_VALID_FOR_EMPLOYMENT' | 'VALID_FOR_WORK_WITH_DHS' | null
  issuedBy: string | null // Usually "SOCIAL SECURITY"
}

/**
 * Generate SSN Card OCR extraction prompt
 */
export function getSsnCardExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Social Security Cards. Extract all data from this SSN card image accurately.

IMPORTANT: This is a sensitive identity document. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

NAME INFORMATION:
- fullName: Complete name as shown on card
- firstName: First name only
- middleName: Middle name (if present, null otherwise)
- lastName: Last name/surname

SSN (Social Security Number):
- ssn: The 9-digit SSN (format: XXX-XX-XXXX with dashes)

CARD TYPE:
- cardType: Determine card type from any restrictions shown:
  - "REGULAR" - No restrictions (standard card)
  - "NOT_VALID_FOR_EMPLOYMENT" - Has "NOT VALID FOR EMPLOYMENT" text
  - "VALID_FOR_WORK_WITH_DHS" - Has "VALID FOR WORK ONLY WITH DHS AUTHORIZATION" text
- issuedBy: Should be "SOCIAL SECURITY" for valid cards

Respond in JSON format:
{
  "fullName": "JOHN MICHAEL DOE",
  "firstName": "JOHN",
  "middleName": "MICHAEL",
  "lastName": "DOE",
  "ssn": "XXX-XX-XXXX",
  "cardType": "REGULAR",
  "issuedBy": "SOCIAL SECURITY"
}

Rules:
1. SSN MUST include dashes: XXX-XX-XXXX
2. Name should be in the exact case shown on card (usually ALL CAPS)
3. Use null for unclear or missing fields, NEVER guess
4. Look for any restriction text to determine cardType
5. The SSN is the 9-digit number, typically displayed as XXX-XX-XXXX`
}

/**
 * Validate SSN Card extracted data
 */
export function validateSsnCardData(data: unknown): data is SsnCardExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required fields exist
  const requiredFields = ['fullName', 'ssn']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  // Validate SSN format if present
  if (d.ssn !== null && typeof d.ssn === 'string') {
    const ssnPattern = /^\d{3}-\d{2}-\d{4}$/
    if (!ssnPattern.test(d.ssn)) return false
  }

  return true
}

/**
 * Get field labels in Vietnamese for SSN Card
 */
export const SSN_CARD_FIELD_LABELS_VI: Record<string, string> = {
  fullName: 'Họ tên đầy đủ',
  firstName: 'Tên',
  middleName: 'Tên đệm',
  lastName: 'Họ',
  ssn: 'Số An sinh Xã hội (SSN)',
  cardType: 'Loại thẻ',
  issuedBy: 'Cơ quan cấp',
}

// ============================================
// DRIVER'S LICENSE TYPES AND PROMPTS
// ============================================

/**
 * Driver's License extracted data structure
 */
export interface DriverLicenseExtractedData {
  // Personal Information
  fullName: string | null
  firstName: string | null
  middleName: string | null
  lastName: string | null
  dateOfBirth: string | null // Format: MM/DD/YYYY or YYYY-MM-DD

  // Address
  address: string | null
  city: string | null
  state: string | null
  zipCode: string | null

  // License Details
  licenseNumber: string | null
  licenseClass: string | null // e.g., "C", "D", "M"
  issuedDate: string | null // Format: MM/DD/YYYY
  expirationDate: string | null // Format: MM/DD/YYYY

  // Physical Description
  sex: 'M' | 'F' | 'X' | null
  height: string | null // e.g., "5-10" or "5'10"
  weight: string | null // e.g., "180"
  eyeColor: string | null // e.g., "BRN", "BLU"

  // Additional
  restrictions: string | null // Restriction codes
  endorsements: string | null // Endorsement codes
  documentDiscriminator: string | null // DD number (unique identifier)
  issuingState: string | null // State that issued the license
}

/**
 * Generate Driver's License OCR extraction prompt
 */
export function getDriverLicenseExtractionPrompt(): string {
  return `You are an expert OCR system for extracting data from U.S. Driver's Licenses and State IDs. Extract all data from this license image accurately.

IMPORTANT: This is a government-issued identity document. Accuracy is critical. If a value is unclear, use null rather than guessing.

Extract the following fields:

PERSONAL INFORMATION:
- fullName: Complete name as shown
- firstName: First name (FN)
- middleName: Middle name (if present)
- lastName: Last name/surname (LN)
- dateOfBirth: Date of birth (DOB) - format as shown on card

ADDRESS (ADR or Address section):
- address: Street address line
- city: City name
- state: State abbreviation
- zipCode: ZIP code

LICENSE DETAILS:
- licenseNumber: License/ID number (DL or ID NO)
- licenseClass: Class (e.g., "C", "D", "CDL")
- issuedDate: Issue date (ISS)
- expirationDate: Expiration date (EXP)

PHYSICAL DESCRIPTION:
- sex: Sex/Gender (M, F, or X)
- height: Height (HGT) - keep original format
- weight: Weight (WGT) in pounds
- eyeColor: Eye color code (EYES) - e.g., BRN, BLU, GRN, HAZ

ADDITIONAL INFO:
- restrictions: Any restriction codes (REST)
- endorsements: Any endorsement codes (END)
- documentDiscriminator: DD number if visible
- issuingState: State that issued the license

Respond in JSON format:
{
  "fullName": "JOHN MICHAEL DOE",
  "firstName": "JOHN",
  "middleName": "MICHAEL",
  "lastName": "DOE",
  "dateOfBirth": "01/15/1985",
  "address": "123 MAIN STREET APT 4",
  "city": "LOS ANGELES",
  "state": "CA",
  "zipCode": "90001",
  "licenseNumber": "D1234567",
  "licenseClass": "C",
  "issuedDate": "03/15/2022",
  "expirationDate": "01/15/2027",
  "sex": "M",
  "height": "5-10",
  "weight": "180",
  "eyeColor": "BRN",
  "restrictions": "A",
  "endorsements": null,
  "documentDiscriminator": null,
  "issuingState": "CA"
}

Rules:
1. Extract data exactly as shown on the card
2. Use null for unclear or missing fields, NEVER guess
3. Keep date formats as shown on the document
4. License numbers vary by state - extract exactly as shown
5. Name is usually in ALL CAPS on licenses
6. Eye color typically uses 3-letter codes (BRN, BLU, GRN, HAZ, GRY, BLK)`
}

/**
 * Validate Driver's License extracted data
 */
export function validateDriverLicenseData(data: unknown): data is DriverLicenseExtractedData {
  if (!data || typeof data !== 'object') return false

  const d = data as Record<string, unknown>

  // Check required fields exist
  const requiredFields = ['fullName', 'licenseNumber', 'expirationDate', 'issuingState']
  for (const field of requiredFields) {
    if (!(field in d)) return false
  }

  return true
}

/**
 * Get field labels in Vietnamese for Driver's License
 */
export const DRIVER_LICENSE_FIELD_LABELS_VI: Record<string, string> = {
  fullName: 'Họ tên đầy đủ',
  firstName: 'Tên',
  middleName: 'Tên đệm',
  lastName: 'Họ',
  dateOfBirth: 'Ngày sinh',
  address: 'Địa chỉ',
  city: 'Thành phố',
  state: 'Tiểu bang',
  zipCode: 'Mã ZIP',
  licenseNumber: 'Số bằng lái',
  licenseClass: 'Hạng bằng',
  issuedDate: 'Ngày cấp',
  expirationDate: 'Ngày hết hạn',
  sex: 'Giới tính',
  height: 'Chiều cao',
  weight: 'Cân nặng',
  eyeColor: 'Màu mắt',
  restrictions: 'Hạn chế',
  endorsements: 'Chứng nhận bổ sung',
  issuingState: 'Tiểu bang cấp',
}
