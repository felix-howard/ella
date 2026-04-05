/**
 * Address Parsing Prompt
 * Prompt for extracting structured address components from raw US address strings
 * Used as fallback when regex-based parsing fails to extract city
 */

/**
 * Input structure for batch address parsing
 */
export interface AddressParseInput {
  index: number
  raw: string
}

/**
 * Output structure for a single parsed address
 */
export interface AddressParseResult {
  index: number
  address: string // street address only
  city: string
  state: string
  zip: string
}

/**
 * Full response from Gemini
 */
export interface AddressParseResponse {
  addresses: AddressParseResult[]
}

const MAX_ADDRESS_LENGTH = 200

/**
 * Sanitize raw address string before prompt interpolation
 */
function sanitizeAddress(raw: string): string {
  return raw
    .replace(/[^\x20-\x7E]/g, '') // ASCII printable only
    .slice(0, MAX_ADDRESS_LENGTH)
}

/**
 * Generate the address parsing prompt
 */
export function getAddressParsePrompt(inputs: AddressParseInput[]): string {
  const addressList = inputs
    .map((a) => `  ${a.index}: "${sanitizeAddress(a.raw)}"`)
    .join('\n')

  return `Parse these US addresses into structured components. Extract street address, city, state, and zip code.

ADDRESSES:
${addressList}

RULES:
1. Street address = everything before the city name
2. City = the city/town name
3. State = 2-letter state code (FL, CA, TX, etc.)
4. Zip = 5-digit or 9-digit zip code
5. Do NOT invent data - if you cannot determine a field, use empty string ""
6. Apartment/unit numbers stay in the street address

EXAMPLES:
Input: "6424 NW 53 RD ST LAUDERHILL, FL 33319"
Output: { address: "6424 NW 53 RD ST", city: "LAUDERHILL", state: "FL", zip: "33319" }

Input: "7610 STIRLING RD APT D105 HOLLYWOOD FL 33024"
Output: { address: "7610 STIRLING RD APT D105", city: "HOLLYWOOD", state: "FL", zip: "33024" }

Input: "4951 NW 45 TER COCONUT CREEK, FL 33066"
Output: { address: "4951 NW 45 TER", city: "COCONUT CREEK", state: "FL", zip: "33066" }

Respond in JSON format only:
{
  "addresses": [
    { "index": 0, "address": "...", "city": "...", "state": "...", "zip": "..." },
    ...
  ]
}

CRITICAL: Return ONLY valid JSON. No markdown, no explanation.`
}

/**
 * Validate address parse response from Gemini
 */
export function validateAddressParseResponse(
  result: unknown
): result is AddressParseResponse {
  if (!result || typeof result !== 'object') return false

  const r = result as Record<string, unknown>
  if (!Array.isArray(r.addresses)) return false

  for (const addr of r.addresses) {
    if (!validateAddressResult(addr)) return false
  }

  return true
}

/**
 * Validate individual address result
 */
function validateAddressResult(addr: unknown): addr is AddressParseResult {
  if (!addr || typeof addr !== 'object') return false

  const a = addr as Record<string, unknown>
  if (typeof a.index !== 'number') return false
  if (typeof a.address !== 'string') return false
  if (typeof a.city !== 'string') return false
  if (typeof a.state !== 'string') return false
  if (typeof a.zip !== 'string') return false

  return true
}
