import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: (() => {
    const prisma = {
      $transaction: vi.fn(),
      $queryRaw: vi.fn(),
      rawImage: {
        findFirst: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      checklistItem: {
        findFirst: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      digitalDoc: {
        upsert: vi.fn(),
      },
    }
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    )
    return prisma
  })(),
}))

vi.mock('../../../services/activity-tracker', () => ({
  updateLastActivity: vi.fn(),
}))

vi.mock('../../../services/ai', () => ({
  extractDocumentData: vi.fn(),
  needsManualVerification: vi.fn(),
  isGeminiConfigured: true,
  supportsOcrExtraction: vi.fn(),
  selectBestImage: vi.fn(),
  getGroupImages: vi.fn(),
}))

vi.mock('../../../services/storage', () => ({
  getSignedDownloadUrl: vi.fn(),
}))

vi.mock('../../../lib/org-scope', () => ({
  buildClientScopeFilter: vi.fn(() => ({ organizationId: 'org_1' })),
}))

import { prisma } from '../../../lib/db'
import {
  classifyDocType,
  classifyCreditCardStatement,
  mockManualClassificationState,
} from './manual-classification-test-helpers'

describe('manual document classification', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stores bank/card category when manually classifying a credit card statement', async () => {
    mockManualClassificationState()

    const res = await classifyCreditCardStatement()

    expect(res.status).toBe(200)
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'raw_1' },
      data: expect.objectContaining({
        classifiedType: 'CREDIT_CARD_STATEMENT',
        category: 'BANK_CARD_STATEMENTS',
        status: 'CLASSIFIED',
        checklistItemId: null,
        aiConfidence: 1,
      }),
    })
  })

  it('accepts foreign bank statement manual classification', async () => {
    mockManualClassificationState({ docType: 'FOREIGN_BANK_STATEMENT' })

    const res = await classifyDocType('FOREIGN_BANK_STATEMENT')

    expect(res.status).toBe(200)
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'raw_1' },
      data: expect.objectContaining({
        classifiedType: 'FOREIGN_BANK_STATEMENT',
        category: 'BANK_CARD_STATEMENTS',
      }),
    })
  })

  it('moves checklist linkage and digital doc linkage when reclassifying', async () => {
    mockManualClassificationState({
      lockedChecklistItemId: 'old_item',
      matchedChecklistItemId: 'new_item',
    })

    const res = await classifyCreditCardStatement()

    expect(res.status).toBe(200)
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(prisma.checklistItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'old_item',
        receivedCount: { gt: 0 },
      },
      data: { receivedCount: { decrement: 1 } },
    })
    expect(prisma.checklistItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'old_item',
        receivedCount: { lte: 0 },
      },
      data: { status: 'MISSING' },
    })
    expect(prisma.checklistItem.update).toHaveBeenCalledWith({
      where: { id: 'new_item' },
      data: {
        status: 'HAS_RAW',
        receivedCount: { increment: 1 },
      },
    })
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'raw_1' },
      data: expect.objectContaining({
        checklistItemId: 'new_item',
        status: 'LINKED',
      }),
    })
    expect(prisma.digitalDoc.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          checklistItemId: 'new_item',
        }),
      })
    )
  })

  it('does not adjust checklist counts when the link is already current', async () => {
    mockManualClassificationState({
      lockedChecklistItemId: 'new_item',
      matchedChecklistItemId: 'new_item',
    })

    const res = await classifyCreditCardStatement()

    expect(res.status).toBe(200)
    expect(prisma.checklistItem.updateMany).not.toHaveBeenCalled()
    expect(prisma.checklistItem.update).not.toHaveBeenCalled()
    expect(prisma.rawImage.update).toHaveBeenCalledWith({
      where: { id: 'raw_1' },
      data: expect.objectContaining({
        checklistItemId: 'new_item',
        status: 'LINKED',
      }),
    })
  })
})
