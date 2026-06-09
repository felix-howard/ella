/**
 * Unit tests for the upload-PDF merge helper. Uses real pdf-lib (no mocks) so
 * the page-count math is verified end-to-end.
 */
import { describe, it, expect } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { appendPagesToPdf, countPdfPages } from '../pdf-merge'

async function makePdf(pageCount: number): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) doc.addPage([612, 792])
  return Buffer.from(await doc.save())
}

describe('pdf-merge', () => {
  it('countPdfPages returns the page count', async () => {
    expect(await countPdfPages(await makePdf(3))).toBe(3)
  })

  it('countPdfPages throws on non-PDF bytes', async () => {
    await expect(countPdfPages(Buffer.from('not a pdf'))).rejects.toThrow()
  })

  it('appendPagesToPdf sums base + appended pages', async () => {
    const base = await makePdf(2)
    const append = await makePdf(1)
    const merged = await appendPagesToPdf(base, append)
    expect(await countPdfPages(merged)).toBe(3)
  })

  it('appendPagesToPdf preserves original page count of the base', async () => {
    const base = await makePdf(5)
    const merged = await appendPagesToPdf(base, await makePdf(1))
    expect(await countPdfPages(merged)).toBe(6)
  })
})
