/**
 * Account Executive Agreement PDF generation.
 *
 * Unlike the contractor agreement (fixed source PDF + coordinate overlays), this
 * agreement is rendered entirely from the shared text content, so the signed PDF
 * and the on-screen agreement always come from one source. pdf-lib draws the
 * wrapped paragraphs across paginated US-Letter pages, then a member signature block.
 */
import { createHash } from 'node:crypto'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import type { PDFFont, PDFImage, PDFPage } from 'pdf-lib'
import {
  ACCOUNT_EXECUTIVE_AGREEMENT_CONTENT,
  fillAccountExecutiveAgreementText,
} from '@ella/shared'

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const MAX_SIGNATURE_BYTES = 500_000

// US Letter, pdf-lib bottom-left origin.
const PAGE_WIDTH = 612
const PAGE_HEIGHT = 792
const MARGIN_X = 60
const MARGIN_TOP = 72
const MARGIN_BOTTOM = 72
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2

const BODY_SIZE = 10.5
const HEADING_SIZE = 11.5
const TITLE_SIZE = 16
const LINE_GAP = 3.5
const PARAGRAPH_GAP = 6
const SECTION_GAP = 10
const BULLET_INDENT = 14
const BLACK = rgb(0, 0, 0)

export interface GenerateAccountExecutiveAgreementPdfInput {
  companyName: string
  signerName: string
  signerEmail: string
  signaturePngDataUrl: string
  signedAt: Date
}

export function decodeSignaturePng(dataUrl: string): Buffer {
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

function formatAgreementDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** Greedy word-wrap into lines that fit maxWidth at the given font/size. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate
    } else {
      lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

/** Cursor-based writer that paginates automatically. */
class PdfWriter {
  private page: PDFPage
  private y: number

  constructor(
    private readonly doc: PDFDocument,
    private readonly font: PDFFont,
    private readonly boldFont: PDFFont,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.y = PAGE_HEIGHT - MARGIN_TOP
  }

  /** Break to a new page if `height` would not fit below the current cursor. */
  ensureSpace(height: number): void {
    if (this.y - height < MARGIN_BOTTOM) {
      this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
      this.y = PAGE_HEIGHT - MARGIN_TOP
    }
  }

  moveDown(amount: number): void {
    this.y -= amount
  }

  /** Draw wrapped paragraph text. Bullet lines ("• ...") get a hanging indent. */
  drawParagraph(text: string, opts?: { bold?: boolean; size?: number }): void {
    const size = opts?.size ?? BODY_SIZE
    const font = opts?.bold ? this.boldFont : this.font
    const isBullet = text.startsWith('•')
    const indent = isBullet ? BULLET_INDENT : 0
    const lines = wrapText(text, font, size, CONTENT_WIDTH - indent)
    for (let i = 0; i < lines.length; i++) {
      this.ensureSpace(size + LINE_GAP)
      // Hanging indent: wrapped continuation lines of a bullet align under the text.
      const x = MARGIN_X + (isBullet && i > 0 ? indent : 0)
      this.page.drawText(lines[i], { x, y: this.y, size, font, color: BLACK })
      this.y -= size + LINE_GAP
    }
  }

  drawTitleCentered(text: string): void {
    this.ensureSpace(TITLE_SIZE + LINE_GAP)
    const width = this.boldFont.widthOfTextAtSize(text, TITLE_SIZE)
    const x = (PAGE_WIDTH - width) / 2
    this.page.drawText(text, { x, y: this.y, size: TITLE_SIZE, font: this.boldFont, color: BLACK })
    this.y -= TITLE_SIZE + LINE_GAP
  }

  /** Draw an already-embedded image at the current cursor, advancing past it. */
  drawImage(image: PDFImage, width: number, height: number): void {
    this.ensureSpace(height)
    this.page.drawImage(image, { x: MARGIN_X, y: this.y - height, width, height })
    this.y -= height
  }
}

export async function generateAccountExecutiveAgreementPdf(
  input: GenerateAccountExecutiveAgreementPdfInput,
): Promise<Buffer> {
  const signature = decodeSignaturePng(input.signaturePngDataUrl)

  const doc = await PDFDocument.create()
  const font = await doc.embedFont(StandardFonts.TimesRoman)
  const boldFont = await doc.embedFont(StandardFonts.TimesRomanBold)
  const signatureImage = await doc.embedPng(signature)

  const content = ACCOUNT_EXECUTIVE_AGREEMENT_CONTENT
  const signedDate = formatAgreementDate(input.signedAt)
  const fill = {
    companyName: input.companyName,
    signerName: input.signerName,
    date: signedDate,
  }

  const writer = new PdfWriter(doc, font, boldFont)

  // Title + version
  writer.drawTitleCentered(content.title)
  writer.drawParagraph(`Version ${content.version}`, { size: 9 })
  writer.moveDown(SECTION_GAP)

  // Intro (placeholders filled)
  writer.drawParagraph(fillAccountExecutiveAgreementText(content.intro, fill))
  writer.moveDown(SECTION_GAP)

  // Sections
  for (const section of content.sections) {
    writer.drawParagraph(section.heading, { bold: true, size: HEADING_SIZE })
    writer.moveDown(2)
    for (const paragraph of section.paragraphs) {
      writer.drawParagraph(fillAccountExecutiveAgreementText(paragraph, fill))
      writer.moveDown(PARAGRAPH_GAP)
    }
    writer.moveDown(SECTION_GAP)
  }

  // Signature block — scale signature into a max box and keep the block together.
  const sigDims = signatureImage.scale(1)
  const scale = Math.min(200 / sigDims.width, 60 / sigDims.height, 1)
  const sigWidth = sigDims.width * scale
  const sigHeight = sigDims.height * scale
  // Approx height of the whole block (intro line + 4 labels + signature image).
  const blockHeight = sigHeight + 90
  writer.moveDown(SECTION_GAP)
  writer.ensureSpace(blockHeight)

  writer.drawParagraph(
    'By signing below, the Account Executive acknowledges having read, understood, and agreed to this Agreement.',
  )
  writer.moveDown(SECTION_GAP)
  writer.drawParagraph(`Account Executive: ${input.signerName}`, { bold: true })
  writer.moveDown(PARAGRAPH_GAP)
  writer.drawParagraph('Signature:')
  writer.moveDown(2)
  writer.drawImage(signatureImage, sigWidth, sigHeight)
  writer.moveDown(PARAGRAPH_GAP)
  writer.drawParagraph(`Date: ${signedDate}`)

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
