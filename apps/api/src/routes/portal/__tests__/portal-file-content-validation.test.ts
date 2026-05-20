/**
 * Portal file content validation tests.
 * The public upload route must reject renamed active content before storage.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    $transaction: vi.fn(),
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

vi.mock('../../../services/ai', () => ({
  isGeminiConfigured: false,
}))

vi.mock('../../../services/storage', () => ({
  generateFileKey: vi.fn((caseId: string, filename: string) => `cases/${caseId}/raw/${filename}`),
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
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { recordMagicLinkUsage, validateMagicLink } from '../../../services/magic-link'
import { uploadFile } from '../../../services/storage'
import { portalRoute } from '../index'

const app = new Hono()
app.route('/portal', portalRoute)

function validCaseLink() {
  return {
    valid: true,
    data: {
      magicLinkId: 'link_1',
      scope: 'CASE',
      clientGroupId: null,
      entities: [],
      taxCase: {
        id: 'case_1',
        taxYear: 2025,
        status: 'OPEN',
        client: {
          id: 'client_1',
          name: 'Client One',
          language: 'EN',
          clientGroupId: null,
          organizationId: 'org_1',
        },
        checklistItems: [],
        rawImages: [],
      },
    },
  }
}

describe('Portal file content validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitMapForTests()
    vi.mocked(recordMagicLinkUsage).mockResolvedValue(undefined)
    vi.mocked(validateMagicLink).mockResolvedValue(validCaseLink() as any)
  })

  it('rejects a PDF upload when the bytes are HTML before storage or DB write', async () => {
    const formData = new FormData()
    formData.append(
      'files',
      new File(['<html><script>alert("x")</script></html>'], 'tax.pdf', {
        type: 'application/pdf',
      })
    )

    const res = await app.request('/portal/token_1/upload', {
      method: 'POST',
      body: formData,
    })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.error).toBe('INVALID_FILE_CONTENT')
    expect(uploadFile).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })
})
