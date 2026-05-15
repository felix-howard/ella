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
const FIRM_FIELDS = {
  signature: { x: 100, y: 240, width: 180, height: 42 },
  name: { x: 100, y: 225 },
  title: { x: 100, y: 211 },
  date: { x: 100, y: 197 },
}
const CONTRACTOR_FIELDS = {
  legalName: { x: 72, y: 151 },
  signature: { x: 124, y: 114, width: 160, height: 36 },
  name: { x: 106, y: 101 },
  date: { x: 100, y: 87 },
}

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
  const page = pdfDoc.getPage(SIGNATURE_PAGE_INDEX)
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman)
  const firmSignature = await pdfDoc.embedPng(input.firmSigner.signaturePngBuffer)
  const signerSignature = await pdfDoc.embedPng(contractorSignature)
  const signedDate = formatAgreementDate(input.signedAt)
  const textOptions = { size: 11, font, color: rgb(0, 0, 0) }

  page.drawImage(firmSignature, FIRM_FIELDS.signature)
  page.drawText(input.firmSigner.name, { ...FIRM_FIELDS.name, ...textOptions })
  page.drawText(input.firmSigner.title?.trim() || 'Authorized Representative', {
    ...FIRM_FIELDS.title,
    ...textOptions,
  })
  page.drawText(signedDate, { ...FIRM_FIELDS.date, ...textOptions })

  page.drawText(input.contractor.name, { ...CONTRACTOR_FIELDS.legalName, ...textOptions })
  page.drawImage(signerSignature, CONTRACTOR_FIELDS.signature)
  page.drawText(input.contractor.name, { ...CONTRACTOR_FIELDS.name, ...textOptions })
  page.drawText(signedDate, { ...CONTRACTOR_FIELDS.date, ...textOptions })

  const bytes = await pdfDoc.save()
  return Buffer.from(bytes)
}
