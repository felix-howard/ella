/**
 * Public Rental Route Tests
 * Tests GET /:token, POST /:token/submit, PATCH /:token/draft
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    scheduleEExpense: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// Mock magic-link service
vi.mock('../../../services/magic-link', () => ({
  validateScheduleEToken: vi.fn(),
}))

// Mock expense calculator
vi.mock('../../../services/schedule-e/expense-calculator', () => ({
  calculateScheduleETotals: vi.fn(),
  recalculateAllTotals: vi.fn(),
}))

// Mock version history
vi.mock('../../../services/schedule-e/version-history', () => ({
  createVersionEntry: vi.fn(),
  appendVersionHistory: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { validateScheduleEToken } from '../../../services/magic-link'
import { calculateScheduleETotals, recalculateAllTotals } from '../../../services/schedule-e/expense-calculator'
import { createVersionEntry, appendVersionHistory } from '../../../services/schedule-e/version-history'
import { rentalRoute } from '../index'

const app = new Hono()
app.route('/rental', rentalRoute)

const mockValidateToken = vi.mocked(validateScheduleEToken)
const mockExpenseFindUnique = vi.mocked(prisma.scheduleEExpense.findUnique)
const mockExpenseCreate = vi.mocked(prisma.scheduleEExpense.create)
const mockExpenseUpdate = vi.mocked(prisma.scheduleEExpense.update)
const mockExpenseUpsert = vi.mocked(prisma.scheduleEExpense.upsert)
const mockCalcTotals = vi.mocked(calculateScheduleETotals)
const mockRecalculateAll = vi.mocked(recalculateAllTotals)
const mockCreateVersionEntry = vi.mocked(createVersionEntry)
const mockAppendHistory = vi.mocked(appendVersionHistory)

function validToken() {
  return {
    valid: true as const,
    linkId: 'link-1',
    caseId: 'case-1',
    clientName: 'Test Client',
    clientLanguage: 'vi',
    taxYear: 2025,
  }
}

function expenseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    taxCaseId: 'case-1',
    status: 'SUBMITTED',
    version: 1,
    properties: [
      {
        id: 'A',
        address: { street: '123 Main', city: 'City', state: 'GA', zip: '30301' },
        propertyType: 1,
        monthsRented: 12,
        fairRentalDays: 365,
        personalUseDays: 0,
        rentsReceived: 24000,
        insurance: 1200,
        mortgageInterest: 8000,
        repairs: 500,
        taxes: 3000,
        utilities: 1500,
        managementFees: 1000,
        cleaningMaintenance: 600,
        otherExpenses: [],
        totalExpenses: 15800,
        netIncome: 8200,
      },
    ],
    versionHistory: [],
    submittedAt: new Date('2026-01-28'),
    createdAt: new Date('2026-01-28'),
    updatedAt: new Date('2026-01-28'),
    ...overrides,
  } as any
}

describe('Public Rental Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /rental/:token', () => {
    it('returns form data for valid token', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(expenseRecord())
      mockCalcTotals.mockReturnValueOnce({
        totalRent: 24000,
        totalExpenses: 15800,
        totalNet: 8200,
        propertyCount: 1,
      })

      const res = await app.request('/rental/valid-token')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.client.name).toBe('Test Client')
      expect(json.taxYear).toBe(2025)
      expect(json.expense).not.toBeNull()
      expect(json.expense.properties).toHaveLength(1)
      expect(json.totals.totalRent).toBe(24000)
    })

    it('returns null expense for first access (no existing data)', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(null)

      const res = await app.request('/rental/valid-token')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.expense).toBeNull()
      expect(json.totals).toBeNull()
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'INVALID_TOKEN' })

      const res = await app.request('/rental/bad-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('INVALID_TOKEN')
    })

    it('returns 401 for expired token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'EXPIRED_TOKEN' })

      const res = await app.request('/rental/expired-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('EXPIRED_TOKEN')
      expect(json.message).toContain('hết hạn')
    })

    it('returns 401 for locked form', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'FORM_LOCKED' })

      const res = await app.request('/rental/locked-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('FORM_LOCKED')
      expect(json.message).toContain('khóa')
    })

    it('returns 401 for wrong token type', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'INVALID_TOKEN_TYPE' })

      const res = await app.request('/rental/wrong-type-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('INVALID_TOKEN_TYPE')
    })
  })

  describe('POST /rental/:token/submit', () => {
    const validProperties = [
      {
        id: 'A',
        address: { street: '123 Main', city: 'City', state: 'GA', zip: '30301' },
        propertyType: 1,
        monthsRented: 12,
        fairRentalDays: 365,
        personalUseDays: 0,
        rentsReceived: 24000,
        insurance: 1200,
        mortgageInterest: 8000,
        repairs: 500,
        taxes: 3000,
        utilities: 1500,
        managementFees: 1000,
        cleaningMaintenance: 600,
        otherExpenses: [],
        totalExpenses: 15800,
        netIncome: 8200,
      },
    ]

    it('creates new expense on first submission', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(null)
      mockRecalculateAll.mockReturnValueOnce(validProperties as any)
      const created = expenseRecord({ version: 1, status: 'SUBMITTED' })
      mockExpenseCreate.mockResolvedValueOnce(created)
      mockCreateVersionEntry.mockReturnValueOnce({
        version: 1,
        submittedAt: new Date().toISOString(),
        changes: ['Tạo mới'],
        properties: validProperties,
      })
      mockExpenseUpdate.mockResolvedValueOnce(created)

      const res = await app.request('/rental/valid-token/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: validProperties }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.version).toBe(1)
      expect(json.status).toBe('SUBMITTED')
    })

    it('updates existing expense and increments version', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      const existing = expenseRecord({ version: 1, status: 'SUBMITTED' })
      mockExpenseFindUnique.mockResolvedValueOnce(existing)
      mockRecalculateAll.mockReturnValueOnce(validProperties as any)
      const updated = expenseRecord({ version: 2, status: 'SUBMITTED' })
      mockExpenseUpdate.mockResolvedValueOnce(updated)
      mockCreateVersionEntry.mockReturnValueOnce({
        version: 2,
        submittedAt: new Date().toISOString(),
        changes: ['Cập nhật bất động sản A'],
        properties: validProperties,
      })
      mockAppendHistory.mockReturnValueOnce([
        { version: 1, submittedAt: '', changes: ['Tạo mới'], properties: [] },
        { version: 2, submittedAt: '', changes: ['Cập nhật'], properties: [] },
      ])
      mockExpenseUpdate.mockResolvedValueOnce(updated)

      const res = await app.request('/rental/valid-token/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: validProperties }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.version).toBe(2)
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'INVALID_TOKEN' })

      const res = await app.request('/rental/bad-token/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: [] }),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 for invalid property type', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())

      const invalidProperties = [{
        ...validProperties[0],
        propertyType: 9, // Invalid type
      }]

      const res = await app.request('/rental/valid-token/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: invalidProperties }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for missing address', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())

      const invalidProperties = [{
        ...validProperties[0],
        address: { street: '', city: '', state: '', zip: '' },
      }]

      const res = await app.request('/rental/valid-token/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: invalidProperties }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('PATCH /rental/:token/draft', () => {
    it('saves draft without version history', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const res = await app.request('/rental/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: [] }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.message).toContain('tự động lưu')
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'EXPIRED_TOKEN' })

      const res = await app.request('/rental/expired/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(401)
    })

    it('accepts partial property data for draft', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const partialProperties = [{
        id: 'A',
        address: { street: '123 Main', city: '', state: '', zip: '' },
        propertyType: 1,
        monthsRented: 6,
      }]

      const res = await app.request('/rental/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: partialProperties }),
      })

      expect(res.status).toBe(200)
    })

    it('saves multiple properties in draft', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const multipleProperties = [
        { id: 'A', address: { street: '123', city: 'A', state: 'GA', zip: '30301' }, propertyType: 1 },
        { id: 'B', address: { street: '456', city: 'B', state: 'GA', zip: '30302' }, propertyType: 2 },
      ]

      const res = await app.request('/rental/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: multipleProperties }),
      })

      expect(res.status).toBe(200)
      expect(mockExpenseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            properties: multipleProperties,
          }),
        })
      )
    })
  })
})
