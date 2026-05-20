/**
 * Portal rate-limit tests.
 * Public portal buckets should limit scripted abuse without blocking normal
 * multi-file client uploads.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/db', () => ({
  prisma: {
    $transaction: vi.fn(async (callback) =>
      callback({
        $executeRaw: vi.fn(),
        rawImage: {
          count: vi.fn().mockResolvedValue(0),
          create: vi.fn().mockResolvedValue({
            id: 'img_1',
            status: 'UPLOADED',
            createdAt: new Date('2026-05-18T10:00:00Z'),
          }),
        },
      })
    ),
    rawImage: {
      findMany: vi.fn(),
    },
    taxCase: {
      findUnique: vi.fn(),
    },
    action: {
      create: vi.fn(),
    },
    activityLog: {
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

import { ActivityActorType, ActivityRiskLevel } from '@ella/db'
import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { __resetRateLimitMapForTests } from '../../../middleware/rate-limiter'
import { recordMagicLinkUsage, validateMagicLink } from '../../../services/magic-link'
import { portalRoute } from '../index'

const app = new Hono()
app.route('/portal', portalRoute)

function validCaseLink(token = 'token_1') {
  return {
    valid: true,
    data: {
      magicLinkId: `link_${token}`,
      scope: 'CASE',
      clientGroupId: null,
      entities: [
        {
          caseId: 'case_1',
          clientId: 'client_1',
          name: 'Client One',
          entityType: 'individual',
          businessType: null,
          uploadCount: 0,
          hasChecklist: false,
          taxYear: 2025,
        },
      ],
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

function uploadForm(fileCount = 1) {
  const formData = new FormData()
  for (let index = 0; index < fileCount; index++) {
    formData.append(
      'files',
      new File([`test-${index}`], `document-${index}.pdf`, {
        type: 'application/pdf',
      })
    )
  }
  return formData
}

describe('Portal rate limits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    __resetRateLimitMapForTests()
    vi.mocked(prisma.action.create).mockResolvedValue({} as never)
    vi.mocked(prisma.activityLog.create).mockResolvedValue({ id: 'activity_1' } as never)
    vi.mocked(recordMagicLinkUsage).mockResolvedValue(undefined)
    vi.mocked(validateMagicLink).mockImplementation(async (token: string) => {
      if (token.startsWith('valid')) return validCaseLink(token) as any
      return { valid: false, error: 'INVALID_TOKEN' }
    })
  })

  it('limits repeated portal reads per valid token and IP', async () => {
    for (let index = 0; index < 120; index++) {
      const res = await app.request('/portal/valid_a', {
        headers: { 'cf-connecting-ip': '203.0.113.10' },
      })
      expect(res.status).toBe(200)
    }

    const limited = await app.request('/portal/valid_a', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    })
    const json = await limited.json()

    expect(limited.status).toBe(429)
    expect(json.error).toBe('RATE_LIMITED')
    expect(limited.headers.get('Retry-After')).toMatch(/^\d+$/)
    expect(recordMagicLinkUsage).toHaveBeenCalledTimes(120)
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        clientId: 'client_1',
        caseId: 'case_1',
        magicLinkId: 'link_valid_a',
        actorType: ActivityActorType.CLIENT_PORTAL,
        action: 'system.rate_limited',
        category: 'SYSTEM',
        targetType: 'MAGIC_LINK',
        targetId: 'link_valid_a',
        riskLevel: ActivityRiskLevel.MEDIUM,
        ipAddress: 'unknown',
      }),
    })
  })

  it('keeps rate-limit buckets isolated across tokens on the same IP', async () => {
    for (let index = 0; index < 120; index++) {
      await app.request('/portal/valid_a', {
        headers: { 'cf-connecting-ip': '203.0.113.10' },
      })
    }

    const limited = await app.request('/portal/valid_a', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    })
    const otherToken = await app.request('/portal/valid_b', {
      headers: { 'cf-connecting-ip': '203.0.113.10' },
    })

    expect(limited.status).toBe(429)
    expect(otherToken.status).toBe(200)
  })

  it('limits invalid token probes by IP without writing audit activity', async () => {
    for (let index = 0; index < 30; index++) {
      const res = await app.request(`/portal/bad_${index}`, {
        headers: { 'cf-connecting-ip': '198.51.100.20' },
      })
      expect(res.status).toBe(401)
    }

    expect(validateMagicLink).toHaveBeenCalledTimes(30)

    const limited = await app.request('/portal/bad_31', {
      headers: { 'cf-connecting-ip': '198.51.100.20' },
    })

    expect(limited.status).toBe(429)
    expect(validateMagicLink).toHaveBeenCalledTimes(30)
    expect(prisma.activityLog.create).not.toHaveBeenCalled()
  })

  it('does not let spoofed forwarded IP headers reset the bucket', async () => {
    for (let index = 0; index < 120; index++) {
      const res = await app.request('/portal/valid_spoofed', {
        headers: {
          'cf-connecting-ip': `198.51.100.${index % 100}`,
          'x-forwarded-for': `203.0.113.${index % 100}`,
        },
      })
      expect(res.status).toBe(200)
    }

    const limited = await app.request('/portal/valid_spoofed', {
      headers: {
        'cf-connecting-ip': '198.51.100.200',
        'x-forwarded-for': '203.0.113.200',
      },
    })

    expect(limited.status).toBe(429)
  })

  it('allows a normal 50-file upload in one request', async () => {
    const res = await app.request('/portal/valid_upload/upload', {
      method: 'POST',
      body: uploadForm(50),
      headers: { 'cf-connecting-ip': '203.0.113.30' },
    })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.uploaded).toBe(50)
  })

  it('limits repeated upload attempts per valid token and IP', async () => {
    for (let index = 0; index < 20; index++) {
      const res = await app.request('/portal/valid_upload/upload', {
        method: 'POST',
        body: uploadForm(),
        headers: { 'cf-connecting-ip': '203.0.113.40' },
      })
      expect(res.status).toBe(200)
    }

    const limited = await app.request('/portal/valid_upload/upload', {
      method: 'POST',
      body: uploadForm(),
      headers: { 'cf-connecting-ip': '203.0.113.40' },
    })
    const json = await limited.json()

    expect(limited.status).toBe(429)
    expect(json.error).toBe('RATE_LIMITED')
    expect(recordMagicLinkUsage).toHaveBeenCalledTimes(20)
    expect(prisma.activityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        magicLinkId: 'link_valid_upload',
        actorType: ActivityActorType.CLIENT_PORTAL,
        action: 'system.rate_limited',
        category: 'SYSTEM',
        targetType: 'MAGIC_LINK',
        targetId: 'link_valid_upload',
        riskLevel: ActivityRiskLevel.MEDIUM,
        ipAddress: 'unknown',
      }),
    })
  })
})
