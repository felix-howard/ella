/**
 * Schedule C Staff Route Tests
 * Tests POST /send, GET /:caseId, PATCH /lock, PATCH /unlock, POST /resend
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@ella/db'

const Decimal = Prisma.Decimal

// Mock prisma - vi.mock hoisted above imports by vitest transform.
// $transaction mocked as vi.fn() since lock/unlock tests only verify it's called,
// actual transaction logic tested via integration tests.
vi.mock('../../../lib/db', () => ({
  prisma: {
    taxCase: { findUnique: vi.fn() },
    scheduleCExpense: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    magicLink: {
      findFirst: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock magic-link service
vi.mock('../../../services/magic-link', () => ({
  createMagicLink: vi.fn(),
  createMagicLinkWithDeactivation: vi.fn(),
  getScheduleCMagicLink: vi.fn(),
  extendMagicLinkExpiry: vi.fn(),
}))

// Mock SMS service
vi.mock('../../../services/sms/message-sender', () => ({
  sendScheduleCFormMessage: vi.fn(),
}))

// Mock expense calculator
vi.mock('../../../services/schedule-c/expense-calculator', () => ({
  calculateGrossReceipts: vi.fn(),
  calculateScheduleCTotals: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import {
  createMagicLinkWithDeactivation,
  getScheduleCMagicLink,
  extendMagicLinkExpiry,
  createMagicLink,
} from '../../../services/magic-link'
import { sendScheduleCFormMessage } from '../../../services/sms/message-sender'
import {
  calculateGrossReceipts,
  calculateScheduleCTotals,
} from '../../../services/schedule-c/expense-calculator'
import { scheduleCRoute } from '../index'

// Create test app with mock auth middleware
const app = new Hono()
app.use('*', async (c, next) => {
  c.set('user' as any, { staffId: 'staff-1' })
  await next()
})
app.route('/schedule-c', scheduleCRoute)

const mockFindUnique = vi.mocked(prisma.taxCase.findUnique)
const mockExpenseFindUnique = vi.mocked(prisma.scheduleCExpense.findUnique)
const mockExpenseUpsert = vi.mocked(prisma.scheduleCExpense.upsert)
const mockExpenseUpdate = vi.mocked(prisma.scheduleCExpense.update)
const mockMagicLinkFindFirst = vi.mocked(prisma.magicLink.findFirst)
const mockTransaction = vi.mocked(prisma.$transaction)
const mockCreateMagicLinkWithDeactivation = vi.mocked(createMagicLinkWithDeactivation)
const mockSendSMS = vi.mocked(sendScheduleCFormMessage)
const mockCalcGrossReceipts = vi.mocked(calculateGrossReceipts)
const mockCalcTotals = vi.mocked(calculateScheduleCTotals)
const mockGetScheduleCLink = vi.mocked(getScheduleCMagicLink)
const mockExtendExpiry = vi.mocked(extendMagicLinkExpiry)
const mockCreateMagicLink = vi.mocked(createMagicLink)

function mockCase(overrides: Record<string, unknown> = {}) {
  return {
    id: 'case-1',
    client: { name: 'Test Client', phone: '+1234567890', language: 'vi' },
    scheduleCExpense: null,
    ...overrides,
  }
}

describe('Schedule C Staff Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('POST /schedule-c/:caseId/send', () => {
    it('sends SMS and creates Schedule C (happy path)', async () => {
      const expiresAt = new Date('2026-02-04')
      mockFindUnique.mockResolvedValueOnce(mockCase() as any)
      mockCalcGrossReceipts.mockResolvedValueOnce(new Decimal('5000'))
      mockExpenseUpsert.mockResolvedValueOnce({ id: 'exp-1' } as any)
      mockCreateMagicLinkWithDeactivation.mockResolvedValueOnce({
        url: 'http://localhost:5173/expense/abc123',
        expiresAt,
      })
      mockSendSMS.mockResolvedValueOnce({ smsSent: true } as any)

      const res = await app.request('/schedule-c/case-1/send', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.magicLink).toBe('http://localhost:5173/expense/abc123')
      expect(json.messageSent).toBe(true)
      expect(json.prefilledGrossReceipts).toBe('5000.00')
    })

    it('returns 404 when case not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/bad-id/send', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('CASE_NOT_FOUND')
    })

    it('returns 400 when client has no phone', async () => {
      mockFindUnique.mockResolvedValueOnce(
        mockCase({ client: { name: 'No Phone', phone: null, language: 'vi' } }) as any
      )

      const res = await app.request('/schedule-c/case-1/send', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NO_PHONE')
    })

    it('returns 400 when Schedule C is locked', async () => {
      mockFindUnique.mockResolvedValueOnce(
        mockCase({ scheduleCExpense: { status: 'LOCKED' } }) as any
      )

      const res = await app.request('/schedule-c/case-1/send', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('ALREADY_LOCKED')
    })

    it('sends with zero grossReceipts when no 1099-NECs', async () => {
      mockFindUnique.mockResolvedValueOnce(mockCase() as any)
      mockCalcGrossReceipts.mockResolvedValueOnce(new Decimal('0'))
      mockExpenseUpsert.mockResolvedValueOnce({ id: 'exp-1' } as any)
      mockCreateMagicLinkWithDeactivation.mockResolvedValueOnce({
        url: 'http://test/expense/tok',
        expiresAt: new Date(),
      })
      mockSendSMS.mockResolvedValueOnce({ smsSent: true } as any)

      const res = await app.request('/schedule-c/case-1/send', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.prefilledGrossReceipts).toBe('0.00')
    })
  })

  describe('GET /schedule-c/:caseId', () => {
    it('returns expense, magic link, and totals', async () => {
      const expense = {
        id: 'exp-1',
        status: 'SUBMITTED',
        grossReceipts: new Decimal('5000'),
        returns: null,
        costOfGoods: null,
        otherIncome: null,
        advertising: new Decimal('100'),
        carExpense: null,
        commissions: null,
        contractLabor: null,
        depletion: null,
        depreciation: null,
        employeeBenefits: null,
        insurance: null,
        interestMortgage: null,
        interestOther: null,
        legalServices: null,
        officeExpense: null,
        pensionPlans: null,
        rentEquipment: null,
        rentProperty: null,
        repairs: null,
        supplies: null,
        taxesAndLicenses: null,
        travel: null,
        meals: null,
        utilities: null,
        wages: null,
        otherExpenses: null,
        createdAt: new Date('2026-01-28'),
        updatedAt: new Date('2026-01-28'),
        submittedAt: new Date('2026-01-28'),
        lockedAt: null,
        vehicleDateInService: null,
      }

      mockFindUnique.mockResolvedValueOnce(
        mockCase({ scheduleCExpense: expense }) as any
      )
      mockMagicLinkFindFirst.mockResolvedValueOnce({
        id: 'link-1',
        token: 'abc123',
        isActive: true,
        expiresAt: new Date('2026-02-04'),
        lastUsedAt: null,
        usageCount: 0,
        createdAt: new Date(),
      } as any)
      mockCalcTotals.mockReturnValueOnce({
        grossReceipts: new Decimal('5000'),
        returns: new Decimal('0'),
        costOfGoods: new Decimal('0'),
        grossIncome: new Decimal('5000'),
        totalExpenses: new Decimal('100'),
        mileageDeduction: new Decimal('0'),
        netProfit: new Decimal('4900'),
      })

      const res = await app.request('/schedule-c/case-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.expense).not.toBeNull()
      expect(json.expense.grossReceipts).toBe('5000.00')
      expect(json.expense.advertising).toBe('100.00')
      expect(json.magicLink).not.toBeNull()
      expect(json.magicLink.token).toBe('abc123')
      expect(json.totals.netProfit).toBe('4900.00')
    })

    it('returns null expense when no Schedule C', async () => {
      mockFindUnique.mockResolvedValueOnce(mockCase() as any)
      mockMagicLinkFindFirst.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/case-1')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.expense).toBeNull()
      expect(json.magicLink).toBeNull()
      expect(json.totals).toBeNull()
    })

    it('returns 404 when case not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/bad-id')
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('CASE_NOT_FOUND')
    })
  })

  describe('PATCH /schedule-c/:caseId/lock', () => {
    it('locks submitted expense and deactivates links', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce({
        id: 'exp-1',
        status: 'SUBMITTED',
      } as any)
      mockTransaction.mockResolvedValueOnce(undefined as any)

      const res = await app.request('/schedule-c/case-1/lock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.status).toBe('LOCKED')
      expect(json.lockedAt).toBeDefined()
    })

    it('returns 404 when no expense exists', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/case-1/lock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('NOT_FOUND')
    })

    it('returns 400 when already locked (idempotent check)', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce({
        id: 'exp-1',
        status: 'LOCKED',
      } as any)

      const res = await app.request('/schedule-c/case-1/lock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('ALREADY_LOCKED')
    })

    it('returns 400 when expense is still DRAFT', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce({
        id: 'exp-1',
        status: 'DRAFT',
      } as any)

      const res = await app.request('/schedule-c/case-1/lock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NOT_SUBMITTED')
    })
  })

  describe('PATCH /schedule-c/:caseId/unlock', () => {
    it('unlocks locked expense', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce({
        id: 'exp-1',
        status: 'LOCKED',
      } as any)
      mockExpenseUpdate.mockResolvedValueOnce({} as any)

      const res = await app.request('/schedule-c/case-1/unlock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.status).toBe('SUBMITTED')
    })

    it('returns 404 when no expense exists', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/case-1/unlock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(404)
      expect(json.error).toBe('NOT_FOUND')
    })

    it('returns 400 when not locked', async () => {
      mockExpenseFindUnique.mockResolvedValueOnce({
        id: 'exp-1',
        status: 'SUBMITTED',
      } as any)

      const res = await app.request('/schedule-c/case-1/unlock', { method: 'PATCH' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NOT_LOCKED')
    })
  })

  describe('POST /schedule-c/:caseId/resend', () => {
    it('extends existing link TTL and resends SMS', async () => {
      const newExpiry = new Date('2026-02-10')
      mockFindUnique.mockResolvedValueOnce(mockCase() as any)
      mockGetScheduleCLink.mockResolvedValueOnce({
        id: 'link-1',
        token: 'abc123',
        isActive: true,
        expiresAt: new Date(),
      } as any)
      mockExtendExpiry.mockResolvedValueOnce(newExpiry)
      mockSendSMS.mockResolvedValueOnce({ smsSent: true } as any)

      const res = await app.request('/schedule-c/case-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.messageSent).toBe(true)
    })

    it('creates new link when none exists', async () => {
      mockFindUnique.mockResolvedValueOnce(mockCase() as any)
      mockGetScheduleCLink
        .mockResolvedValueOnce(null)  // First call: no existing link
      mockCreateMagicLink.mockResolvedValueOnce('http://test/expense/new-token')
      mockGetScheduleCLink
        .mockResolvedValueOnce({  // Second call: after creation
          id: 'link-2',
          token: 'new-token',
          expiresAt: new Date('2026-02-10'),
        } as any)
      mockSendSMS.mockResolvedValueOnce({ smsSent: true } as any)

      const res = await app.request('/schedule-c/case-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
    })

    it('returns 404 when case not found', async () => {
      mockFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/schedule-c/case-1/resend', { method: 'POST' })
      expect(res.status).toBe(404)
    })

    it('returns 400 when no phone', async () => {
      mockFindUnique.mockResolvedValueOnce(
        mockCase({ client: { name: 'X', phone: null, language: 'vi' } }) as any
      )

      const res = await app.request('/schedule-c/case-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('NO_PHONE')
    })

    it('returns 400 when form is locked', async () => {
      mockFindUnique.mockResolvedValueOnce(
        mockCase({ scheduleCExpense: { status: 'LOCKED' } }) as any
      )

      const res = await app.request('/schedule-c/case-1/resend', { method: 'POST' })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('FORM_LOCKED')
    })
  })
})
