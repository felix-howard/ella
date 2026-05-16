import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE } from './contractor-agreement-config'

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_SIGNATURE_BYTES = 500_000

// Source PDF is US Letter, 612 x 792. Coordinates use pdf-lib's bottom-left origin.
const SIGNATURE_PAGE_INDEX = 10
const TRAILING_BLANK_PAGE_INDEX = 11
const FIRST_PAGE_REDACTIONS = [
  // Remove ", located at [Contractor Address]" from the fixed source template.
  { x: 311, y: 497, width: 170, height: 18 },
]
const FIRM_FIELDS = {
  signature: { x: 100, y: 240, width: 180, height: 42 },
  name: { x: 100, y: 250.94 },
  title: { x: 100, y: 237.14 },
  date: { x: 100, y: 223.34 },
}
const CONTRACTOR_FIELDS = {
  legalNameMask: { x: 70, y: 150, width: 145, height: 17 },
  legalName: { x: 72, y: 153.98 },
  signature: { x: 124, y: 114, width: 160, height: 36 },
  name: { x: 106, y: 112.34 },
  date: { x: 100, y: 98.52 },
}
const WHITE = rgb(1, 1, 1)

export interface ContractorAgreementSigner {
  name: string
  email: string
  title?: string | null
  signaturePngBuffer: Buffer
}

export interface GenerateContractorAgreementPdfInput {
  contractor: {
    name: string
    email: string
    signaturePngDataUrl: string
  }
  firmSigner: ContractorAgreementSigner
  signedAt: Date
}

export function decodeContractorSignaturePng(dataUrl: string): Buffer {
  if (!dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
    throw new Error('Invalid signature image format')
  }

  const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64')
  if (buffer.length === 0) {
    throw new Error('Signature image is empty')
  }
  if (buffer.length > MAX_SIGNATURE_BYTES) {
    throw new Error('Signature image too large')
  }
  if (buffer.length < PNG_MAGIC.length || !PNG_MAGIC.equals(buffer.subarray(0, PNG_MAGIC.length))) {
    throw new Error('Signature image is not a valid PNG')
  }

  return buffer
}

export function sha256Hex(buffer: Buffer | Uint8Array): string {
  return createHash('sha256').update(buffer).digest('hex')
}

export async function loadContractorAgreementTemplate(): Promise<Buffer> {
  const candidates = [
    join(process.cwd(), 'src/assets/agreements', CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE.assetFilename),
    join(process.cwd(), 'dist/assets/agreements', CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE.assetFilename),
    join(process.cwd(), 'apps/api/src/assets/agreements', CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE.assetFilename),
  ]

  for (const path of candidates) {
    try {
      return await readFile(path)
    } catch {
      // Try the next runtime layout.
    }
  }

  throw new Error(`Contractor agreement template not found: ${CURRENT_CONTRACTOR_AGREEMENT_TEMPLATE.assetFilename}`)
}

function formatAgreementDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function assertPngBuffer(buffer: Buffer, label: string): void {
  if (buffer.length < PNG_MAGIC.length || !PNG_MAGIC.equals(buffer.subarray(0, PNG_MAGIC.length))) {
    throw new Error(`${label} signature image is not a valid PNG`)
  }
}

export async function generateContractorAgreementPdf(
  input: GenerateContractorAgreementPdfInput,
): Promise<Buffer> {
  const contractorSignature = decodeContractorSignaturePng(input.contractor.signaturePngDataUrl)
  assertPngBuffer(input.firmSigner.signaturePngBuffer, 'Firm signer')

  const templateBytes = await loadContractorAgreementTemplate()
  const pdfDoc = await PDFDocument.load(templateBytes)
  const firstPage = pdfDoc.getPage(0)
  const page = pdfDoc.getPage(SIGNATURE_PAGE_INDEX)
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const firmSignature = await pdfDoc.embedPng(input.firmSigner.signaturePngBuffer)
  const signerSignature = await pdfDoc.embedPng(contractorSignature)
  const signedDate = formatAgreementDate(input.signedAt)
  const textOptions = { size: 11, font, color: rgb(0, 0, 0) }

  for (const redaction of FIRST_PAGE_REDACTIONS) {
    firstPage.drawRectangle({ ...redaction, color: WHITE })
  }

  page.drawImage(firmSignature, FIRM_FIELDS.signature)
  page.drawText(input.firmSigner.name, { ...FIRM_FIELDS.name, ...textOptions })
  page.drawText(input.firmSigner.title?.trim() || 'Authorized Representative', {
    ...FIRM_FIELDS.title,
    ...textOptions,
  })
  page.drawText(signedDate, { ...FIRM_FIELDS.date, ...textOptions })

  page.drawRectangle({ ...CONTRACTOR_FIELDS.legalNameMask, color: WHITE })
  page.drawText(input.contractor.name, { ...CONTRACTOR_FIELDS.legalName, ...textOptions })
  page.drawImage(signerSignature, CONTRACTOR_FIELDS.signature)
  page.drawText(input.contractor.name, { ...CONTRACTOR_FIELDS.name, ...textOptions })
  page.drawText(signedDate, { ...CONTRACTOR_FIELDS.date, ...textOptions })

  if (pdfDoc.getPageCount() > TRAILING_BLANK_PAGE_INDEX) {
    pdfDoc.removePage(TRAILING_BLANK_PAGE_INDEX)
  }

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
