/**
 * Excel parser for nail salon 1099-NEC contractor data
 * Handles non-standard format: 2 contractors per "row block" side-by-side
 * Left contractor: columns A-C, Right contractor: columns E-G
 */
import * as XLSX from 'xlsx'
import { generateJsonContent, isGeminiConfigured } from './ai/gemini-client'
import {
  getAddressParsePrompt,
  validateAddressParseResponse,
  type AddressParseInput,
  type AddressParseResult,
  type AddressParseResponse,
} from './ai/prompts/address-parser'

// --- Types ---

export interface ParsedContractor {
  rowIndex: number
  taxYear: number
  businessName: string
  firstName: string
  lastName: string
  rawAddress: string
  address: string
  city: string
  state: string
  zip: string
  ssn: string
  ssnMasked: string
  tinType: 'SSN' | 'EIN'
  amountPaid: number
  email?: string
  parseWarnings: string[]
}

export interface ParseResult {
  contractors: ParsedContractor[]
  taxYear: number
  businessName: string
  errors: string[]
}

const ADDRESS_WARNING_NEEDS_REVIEW = 'City/address split may need review'
const ADDRESS_WARNING_AI_EXTRACTED = 'City extracted by AI'

// --- Address Parser ---

/**
 * Parse address string into components
 * Input: "6424 NW 53 RD ST LAUDERHILL, FL 33319"
 * Output: { address: "6424 NW 53 RD ST", city: "LAUDERHILL", state: "FL", zip: "33319" }
 */
export function parseAddress(raw: string): {
  address: string
  city: string
  state: string
  zip: string
  warnings: string[]
} {
  const warnings: string[] = []
  const trimmed = raw.trim()

  if (!trimmed) {
    warnings.push('Empty address')
    return { address: '', city: '', state: '', zip: '', warnings }
  }

  // Pattern: "..., ST ZIP" or "... ST ZIP"
  const stateZipPattern = /,?\s+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i
  const match = trimmed.match(stateZipPattern)

  if (!match) {
    warnings.push('Could not parse state/zip from address')
    return { address: trimmed, city: '', state: '', zip: '', warnings }
  }

  const state = match[1].toUpperCase()
  const zip = match[2]
  const beforeStateZip = trimmed.slice(0, match.index).trim()

  // Find city (after last comma)
  const lastCommaIdx = beforeStateZip.lastIndexOf(',')
  if (lastCommaIdx > 0) {
    return {
      address: beforeStateZip.slice(0, lastCommaIdx).trim(),
      city: beforeStateZip.slice(lastCommaIdx + 1).trim(),
      state,
      zip,
      warnings,
    }
  }

  // No comma — city/address split uncertain
  warnings.push(ADDRESS_WARNING_NEEDS_REVIEW)
  return { address: beforeStateZip, city: '', state, zip, warnings }
}

// --- AI Address Parser Fallback ---

const MAX_AI_BATCH_SIZE = 50

/**
 * Parse addresses using Gemini AI when regex fails
 * Returns a Map of index -> parsed result for fast lookup
 */
async function parseAddressesWithAI(
  inputs: AddressParseInput[]
): Promise<Map<number, AddressParseResult>> {
  const resultMap = new Map<number, AddressParseResult>()

  if (!isGeminiConfigured || inputs.length === 0) {
    return resultMap
  }

  // Batch if needed
  const batches: AddressParseInput[][] = []
  for (let i = 0; i < inputs.length; i += MAX_AI_BATCH_SIZE) {
    batches.push(inputs.slice(i, i + MAX_AI_BATCH_SIZE))
  }

  for (const batch of batches) {
    try {
      const prompt = getAddressParsePrompt(batch)
      const response = await generateJsonContent<AddressParseResponse>(prompt)

      if (!response.success || !response.data) {
        console.warn('[ExcelParser] AI address parsing failed:', response.error)
        continue
      }

      if (!validateAddressParseResponse(response.data)) {
        console.warn('[ExcelParser] AI address response validation failed')
        continue
      }

      for (const addr of response.data.addresses) {
        if (addr.city) {
          resultMap.set(addr.index, addr)
        }
      }
    } catch (err) {
      console.error('[ExcelParser] AI address parsing error:', err)
    }
  }

  return resultMap
}

// --- Name Parser ---

/**
 * Parse full name into first/last
 * Handles "LAST FIRST", "FIRST LAST", and multi-word names
 * For Vietnamese names (common in nail salons), assumes LAST FIRST MIDDLE order
 */
function parseName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], lastName: '' }

  // Assume: LAST FIRST [MIDDLE...] (Vietnamese naming convention)
  // The first word is typically the family name
  return {
    firstName: parts.slice(1).join(' '),
    lastName: parts[0],
  }
}

// --- SSN Helpers ---

function stripSSN(raw: string): string {
  return raw.replace(/\D/g, '')
}

function maskSSN(ssn: string): string {
  const digits = stripSSN(ssn)
  if (digits.length < 4) return '***-**-****'
  return `***-**-${digits.slice(-4)}`
}

/**
 * Detect if a TIN is an EIN or SSN based on raw format
 * EIN format: XX-XXXXXXX (2 digits, dash, 7 digits)
 * SSN format: XXX-XX-XXXX (3 digits, dash, 2 digits, dash, 4 digits)
 */
function detectTinType(raw: string): 'SSN' | 'EIN' {
  const trimmed = raw.trim()
  // EIN pattern: 2 digits, dash, 7 digits
  if (/^\d{2}-\d{7}$/.test(trimmed)) return 'EIN'
  return 'SSN'
}

// --- Cell Reader ---

function getCellValue(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): string {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
  if (!cell) return ''
  return String(cell.v ?? '').trim()
}

function getCellNumber(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): number {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })]
  if (!cell) return 0
  if (typeof cell.v === 'number') return cell.v
  const parsed = parseFloat(String(cell.v).replace(/[,$]/g, ''))
  return isNaN(parsed) ? 0 : parsed
}

// --- Block Parser ---

/**
 * Parse a single contractor block starting at a "Tax Year" row
 * Block structure (relative to startRow):
 *   +0: Tax Year | 2025
 *   +1: Business Name | VERDAINT NAIL & SPA
 *   +2: (blank)
 *   +3: Contractor Name | CHAU QUANG TRINH
 *   +4: Address | "6424 NW 53 RD ST LAUDERHILL, FL 33319"
 *   +5: (address overflow possible)
 *   +6: SSS#/EIN | 808-16-7587
 *   +7: Amount Paid | 48444.43
 */
function parseContractorBlock(
  sheet: XLSX.WorkSheet,
  startRow: number,
  labelCol: number,
  valueCol: number
): ParsedContractor | null {
  const warnings: string[] = []

  // Tax Year (row +0)
  const taxYearRaw = getCellValue(sheet, startRow, valueCol)
  const taxYear = parseInt(taxYearRaw, 10)
  if (!taxYear || taxYear < 2000 || taxYear > 2100) {
    return null // Not a valid block
  }

  // Business Name (row +1)
  const businessName = getCellValue(sheet, startRow + 1, valueCol)

  // Contractor Name (row +3)
  const contractorName = getCellValue(sheet, startRow + 3, valueCol)
  if (!contractorName) {
    return null // Empty block
  }

  // Address (row +4, may overflow to row +5)
  let rawAddress = getCellValue(sheet, startRow + 4, valueCol)
  const addressOverflow = getCellValue(sheet, startRow + 5, valueCol)

  // Check if row+5 is address overflow (not a label like "SSS#")
  if (addressOverflow && !addressOverflow.match(/^(sss|ein|ssn|amount)/i)) {
    rawAddress = rawAddress + ' ' + addressOverflow
  }

  // SSN — check row +5 and +6 (depends on address overflow)
  let ssnRaw = ''
  let amountPaid = 0

  // Try to find SSN row by scanning rows +5 to +7
  for (let offset = 5; offset <= 7; offset++) {
    const label = getCellValue(sheet, startRow + offset, labelCol).toLowerCase()
    if (label.includes('sss') || label.includes('ssn') || label.includes('ein')) {
      ssnRaw = getCellValue(sheet, startRow + offset, valueCol)
    }
    if (label.includes('amount') || label.includes('paid')) {
      amountPaid = getCellNumber(sheet, startRow + offset, valueCol)
    }
  }

  // Fallback: if no labeled SSN found, try fixed positions
  if (!ssnRaw) {
    ssnRaw = getCellValue(sheet, startRow + 6, valueCol)
  }
  if (!amountPaid) {
    amountPaid = getCellNumber(sheet, startRow + 7, valueCol)
  }

  // Parse name
  const { firstName, lastName } = parseName(contractorName)
  if (!firstName && !lastName) {
    warnings.push('Could not parse name')
  }

  // Parse address
  const parsed = parseAddress(rawAddress)
  warnings.push(...parsed.warnings)

  // Detect TIN type before stripping
  const tinType = detectTinType(ssnRaw)

  // Validate TIN
  const ssnDigits = stripSSN(ssnRaw)
  if (ssnDigits.length !== 9) {
    warnings.push(`${tinType} has ${ssnDigits.length} digits (expected 9)`)
  }

  // Validate amount
  if (amountPaid <= 0) {
    warnings.push('Amount paid is zero or negative')
  }

  return {
    rowIndex: startRow,
    taxYear,
    businessName,
    firstName,
    lastName,
    rawAddress,
    address: parsed.address,
    city: parsed.city,
    state: parsed.state,
    zip: parsed.zip,
    ssn: ssnDigits,
    ssnMasked: maskSSN(ssnRaw),
    tinType,
    amountPaid,
    parseWarnings: warnings,
  }
}

// --- Main Parser ---

const MAX_ROWS = 5000 // Safety limit to prevent memory abuse

/**
 * Parse nail salon Excel file with 2 contractors per row block
 * Left contractor: columns 0-2 (A-C)
 * Right contractor: columns 4-6 (E-G)
 */
export async function parseNailSalonExcel(buffer: Buffer): Promise<ParseResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const ref = sheet['!ref']

  if (!ref) {
    return { contractors: [], taxYear: 0, businessName: '', errors: ['Empty spreadsheet'] }
  }

  const range = XLSX.utils.decode_range(ref)
  const contractors: ParsedContractor[] = []
  const errors: string[] = []
  let taxYear = 0
  let businessName = ''

  const maxRow = Math.min(range.e.r, range.s.r + MAX_ROWS)
  if (range.e.r > range.s.r + MAX_ROWS) {
    errors.push(`Sheet has ${range.e.r - range.s.r} rows, only scanning first ${MAX_ROWS}`)
  }

  // Scan for "Tax Year" markers in both left (col 0) and right (col 4) columns
  for (let row = range.s.r; row <= maxRow; row++) {
    // Check left column (A)
    const cellA = getCellValue(sheet, row, 0).toLowerCase()
    if (cellA.includes('tax year')) {
      const contractor = parseContractorBlock(sheet, row, 0, 2)
      if (contractor) {
        contractors.push(contractor)
        if (!taxYear) taxYear = contractor.taxYear
        if (!businessName) businessName = contractor.businessName
      }
    }

    // Check right column (E)
    const cellE = getCellValue(sheet, row, 4).toLowerCase()
    if (cellE.includes('tax year')) {
      const contractor = parseContractorBlock(sheet, row, 4, 6)
      if (contractor) {
        contractors.push(contractor)
      }
    }
  }

  if (contractors.length === 0) {
    errors.push('No contractor blocks found. Check Excel format.')
  }

  // --- AI Fallback for Failed Address Parsing ---
  const failedAddresses: Array<{ idx: number; input: AddressParseInput }> = []

  contractors.forEach((c, idx) => {
    if (!c.city && c.rawAddress) {
      failedAddresses.push({
        idx,
        input: { index: idx, raw: c.rawAddress },
      })
    }
  })

  if (failedAddresses.length > 0) {
    console.log(`[ExcelParser] Attempting AI parsing for ${failedAddresses.length} addresses`)

    const aiResults = await parseAddressesWithAI(
      failedAddresses.map((f) => f.input)
    )

    for (const { idx } of failedAddresses) {
      const aiResult = aiResults.get(idx)
      if (aiResult && aiResult.city) {
        const contractor = contractors[idx]
        contractor.city = aiResult.city
        if (aiResult.address) contractor.address = aiResult.address
        if (aiResult.state) contractor.state = aiResult.state
        if (aiResult.zip) contractor.zip = aiResult.zip
        // Replace warning
        const warningIdx = contractor.parseWarnings.indexOf(ADDRESS_WARNING_NEEDS_REVIEW)
        if (warningIdx !== -1) {
          contractor.parseWarnings[warningIdx] = ADDRESS_WARNING_AI_EXTRACTED
        }
      }
    }
  }

  return { contractors, taxYear, businessName, errors }
}
