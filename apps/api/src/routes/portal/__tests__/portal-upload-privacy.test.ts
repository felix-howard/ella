/**
 * Portal upload privacy tests.
 * Public upload endpoints must never echo original or AI-generated filenames.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (callback) => {
      const tx = {
        $executeRaw: vi.fn(),
        rawImage: {
          count: vi.fn(),
          create: vi.fn(),
        },
      }
      return callback(tx)
    }),
    rawImage: {
      findMany: vi.fn(),
    },
    taxCase: {
      findUnique: vi.fn(),
    },
    action: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../../services/magic-link', () => ({
  recordMagicLinkUsage: vi.fn(),
  validateMagicLink: vi.fn(),
}))

vi.mock('../../../lib/validation', () => ({
  validateUploadedFileContent: vi.fn(() => ({ valid: true })),
  validateUploadedFiles: vi.fn(() => ({ valid: true })),
}))

vi.mock('../../../services/ai', () => ({
  isGeminiConfigured: false,
}))

vi.mock('../../../services/storage', () => ({
  generateFileKey: vi.fn((caseId: string) => `cases/${caseId}/raw/generated-key.png`),
  uploadFile: vi.fn(),
}))

vi.mock('../../../lib/inngest', () => ({
  inngest: {
    send: vi.fn(),
  },
}))

vi.mock('../../../services/activity-tracker', () => ({
  updateLastActivity: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { validateMagicLink } from '../../../services/magic-link'
import { portalRoute } from '../index'

const app = new Hono()
app.route('/portal', portalRoute)

const sensitiveFilename = '2025_Driver_License_HuynhHuuPhuoc.png'

interface TransactionMock {
  $executeRaw: ReturnType<typeof vi.fn>
  rawImage: {
    count: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
  }
}

let lastTx: TransactionMock | null = null

function validCaseLink() {
  return {
    valid: true,
    data: {
      scope: 'CASE',
      clientGroupId: null,
      entities: [],
      taxCase: {
        id: 'case_1',
        taxYear: 2025,
        status: 'OPEN',
        client: {
          id: 'client_1',
          name: 'Huynh Huu Phuoc',
          language: 'EN',
          clientGroupId: null,
        },
        checklistItems: [],
        rawImages: [],
      },
    },
  }
}

describe('Portal upload privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    lastTx = null
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => {
      const tx: TransactionMock = {
        $executeRaw: vi.fn(),
        rawImage: {
          count: vi.fn().mockResolvedValue(7),
          create: vi.fn().mockResolvedValue({
            id: 'img_8',
            status: 'UPLOADED',
            createdAt: new Date('2026-05-18T01:23:00Z'),
          }),
        },
      }
      lastTx = tx
      return callback(tx)
    })
    vi.mocked(validateMagicLink).mockResolvedValue(validCaseLink() as any)
  })

  it('lists uploads with safe labels and no original or display filenames', async () => {
    vi.mocked(prisma.rawImage.findMany).mockResolvedValueOnce([
      {
        id: 'img_1',
        filename: sensitiveFilename,
        displayName: '2025 Driver License Huynh Huu Phuoc',
        status: 'UPLOADED',
        createdAt: new Date('2026-05-17T14:34:00Z'),
      },
      {
        id: 'img_2',
        filename: 'W2_HuynhHuuPhuoc_2025.pdf',
        displayName: '2025 W2 Huynh Huu Phuoc',
        status: 'CLASSIFIED',
        createdAt: new Date('2026-05-17T15:00:00Z'),
      },
    ] as any)

    const res = await app.request('/portal/token_1?caseId=case_1')
    const json = await res.json()
    const serialized = JSON.stringify(json)

    expect(res.status).toBe(200)
    expect(json.uploads).toEqual([
      {
        id: 'img_2',
        safeLabel: 'Document 2',
        status: 'CLASSIFIED',
        createdAt: '2026-05-17T15:00:00.000Z',
        sequenceNumber: 2,
      },
      {
        id: 'img_1',
        safeLabel: 'Document 1',
        status: 'UPLOADED',
        createdAt: '2026-05-17T14:34:00.000Z',
        sequenceNumber: 1,
      },
    ])
    expect(serialized).not.toContain(sensitiveFilename)
    expect(serialized).not.toContain('HuynhHuuPhuoc')
    expect(serialized).not.toContain('displayName')
    expect(serialized).not.toContain('filename')
    expect(prisma.rawImage.findMany).toHaveBeenCalledWith({
      where: { caseId: 'case_1' },
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
  })

  it('upload response uses safe labels and does not echo original filenames', async () => {
    vi.mocked(prisma.action.create).mockResolvedValueOnce({} as any)

    const formData = new FormData()
    formData.append('files', new File(['test'], sensitiveFilename, { type: 'image/png' }))

    const res = await app.request('/portal/token_1/upload', {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()
    const serialized = JSON.stringify(json)

    expect(res.status).toBe(200)
    expect(json.images).toEqual([
      {
        id: 'img_8',
        safeLabel: 'Document 8',
        status: 'UPLOADED',
        createdAt: '2026-05-18T01:23:00.000Z',
        sequenceNumber: 8,
      },
    ])
    expect(serialized).not.toContain(sensitiveFilename)
    expect(serialized).not.toContain('HuynhHuuPhuoc')
    expect(serialized).not.toContain('filename')
    expect(prisma.$transaction).toHaveBeenCalledTimes(1)
    expect(lastTx?.$executeRaw).toHaveBeenCalledTimes(1)
    expect(lastTx?.rawImage.count).toHaveBeenCalledWith({ where: { caseId: 'case_1' } })
    expect(lastTx?.rawImage.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        filename: sensitiveFilename,
      }),
      select: {
        id: true,
        status: true,
        createdAt: true,
      },
    })
  })
})
