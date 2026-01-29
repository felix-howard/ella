/**
 * Public Expense Route Tests
 * Tests GET /:token, POST /:token (submit), PATCH /:token/draft (auto-save)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Prisma } from '@ella/db'

const Decimal = Prisma.Decimal

// Mock prisma
vi.mock('../../../lib/db', () => ({
  prisma: {
    scheduleCExpense: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

// Mock magic-link service
vi.mock('../../../services/magic-link', () => ({
  validateScheduleCToken: vi.fn(),
}))

// Mock expense calculator
vi.mock('../../../services/schedule-c/expense-calculator', () => ({
  calculateGrossReceipts: vi.fn(),
  calculateScheduleCTotals: vi.fn(),
}))

// Mock version history
vi.mock('../../../services/schedule-c/version-history', () => ({
  createExpenseSnapshot: vi.fn(),
  createVersionEntry: vi.fn(),
  appendVersionHistory: vi.fn(),
}))

import { Hono } from 'hono'
import { prisma } from '../../../lib/db'
import { validateScheduleCToken } from '../../../services/magic-link'
import { calculateGrossReceipts, calculateScheduleCTotals } from '../../../services/schedule-c/expense-calculator'
import { createExpenseSnapshot, createVersionEntry, appendVersionHistory } from '../../../services/schedule-c/version-history'
import { expenseRoute } from '../index'

const app = new Hono()
app.route('/expense', expenseRoute)

const mockValidateToken = vi.mocked(validateScheduleCToken)
const mockExpenseFindUnique = vi.mocked(prisma.scheduleCExpense.findUnique)
const mockExpenseCreate = vi.mocked(prisma.scheduleCExpense.create)
const mockExpenseUpdate = vi.mocked(prisma.scheduleCExpense.update)
const mockExpenseUpsert = vi.mocked(prisma.scheduleCExpense.upsert)
const mockCalcGrossReceipts = vi.mocked(calculateGrossReceipts)
const mockCalcTotals = vi.mocked(calculateScheduleCTotals)
const mockCreateSnapshot = vi.mocked(createExpenseSnapshot)
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
    isLocked: false,
  }
}

function expenseRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'exp-1',
    taxCaseId: 'case-1',
    status: 'SUBMITTED',
    version: 1,
    businessName: null,
    businessDesc: null,
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
    otherExpensesNotes: null,
    vehicleMiles: null,
    vehicleCommuteMiles: null,
    vehicleOtherMiles: null,
    vehicleDateInService: null,
    vehicleUsedForCommute: false,
    vehicleAnotherAvailable: false,
    vehicleEvidenceWritten: false,
    versionHistory: [],
    submittedAt: new Date('2026-01-28'),
    lockedAt: null,
    lockedById: null,
    createdAt: new Date('2026-01-28'),
    updatedAt: new Date('2026-01-28'),
    ...overrides,
  } as any
}

describe('Public Expense Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET /expense/:token', () => {
    it('returns form data for valid token', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(expenseRecord())
      mockCalcGrossReceipts.mockResolvedValueOnce(new Decimal('5000'))
      mockCalcTotals.mockReturnValueOnce({
        grossReceipts: new Decimal('5000'),
        returns: new Decimal('0'),
        costOfGoods: new Decimal('0'),
        grossIncome: new Decimal('5000'),
        totalExpenses: new Decimal('100'),
        mileageDeduction: new Decimal('0'),
        netProfit: new Decimal('4900'),
      })

      const res = await app.request('/expense/valid-token')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.client.name).toBe('Test Client')
      expect(json.taxYear).toBe(2025)
      expect(json.expense).not.toBeNull()
      expect(json.expense.grossReceipts).toBe('5000.00')
      expect(json.prefilledGrossReceipts).toBe('5000.00')
      expect(json.totals.netProfit).toBe('4900.00')
    })

    it('returns null expense for first access (no existing data)', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(null)
      mockCalcGrossReceipts.mockResolvedValueOnce(new Decimal('3000'))

      const res = await app.request('/expense/valid-token')
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.expense).toBeNull()
      expect(json.totals).toBeNull()
      expect(json.prefilledGrossReceipts).toBe('3000.00')
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'INVALID_TOKEN' })

      const res = await app.request('/expense/bad-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('INVALID_TOKEN')
    })

    it('returns 401 for expired token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'EXPIRED_TOKEN' })

      const res = await app.request('/expense/expired-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('EXPIRED_TOKEN')
      expect(json.message).toContain('hết hạn')
    })

    it('returns 401 for locked form', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'FORM_LOCKED' })

      const res = await app.request('/expense/locked-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('FORM_LOCKED')
      expect(json.message).toContain('khóa')
    })

    it('returns 401 for deactivated link', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'LINK_DEACTIVATED' })

      const res = await app.request('/expense/deactivated-token')
      const json = await res.json()

      expect(res.status).toBe(401)
      expect(json.error).toBe('LINK_DEACTIVATED')
    })
  })

  describe('POST /expense/:token (submit)', () => {
    it('creates new expense on first submission', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseFindUnique.mockResolvedValueOnce(null) // No existing
      const created = expenseRecord({ version: 1, status: 'SUBMITTED' })
      mockExpenseCreate.mockResolvedValueOnce(created)
      mockCreateVersionEntry.mockReturnValueOnce({
        version: 1,
        submittedAt: new Date().toISOString(),
        changes: ['Tạo mới'],
        data: {},
      })
      mockExpenseUpdate.mockResolvedValueOnce(created)

      const res = await app.request('/expense/valid-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grossReceipts: 5000, advertising: 100 }),
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
      mockCreateSnapshot.mockReturnValueOnce({} as any)
      const updated = expenseRecord({ version: 2, status: 'SUBMITTED' })
      mockExpenseUpdate.mockResolvedValueOnce(updated)
      mockCreateVersionEntry.mockReturnValueOnce({
        version: 2,
        submittedAt: new Date().toISOString(),
        changes: ['Cập nhật Quảng cáo'],
        data: {},
      })
      mockAppendHistory.mockReturnValueOnce([
        { version: 1, submittedAt: '', changes: ['Tạo mới'], data: {} },
        { version: 2, submittedAt: '', changes: ['Cập nhật Quảng cáo'], data: {} },
      ])
      mockExpenseUpdate.mockResolvedValueOnce(updated)

      const res = await app.request('/expense/valid-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertising: 200 }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.version).toBe(2)
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'INVALID_TOKEN' })

      const res = await app.request('/expense/bad-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 for negative expense values', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())

      const res = await app.request('/expense/valid-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertising: -100 }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('returns 400 for non-integer mileage', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())

      const res = await app.request('/expense/valid-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleMiles: 100.5 }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })
  })

  describe('PATCH /expense/:token/draft (auto-save)', () => {
    it('saves draft without version history', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const res = await app.request('/expense/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advertising: 50, businessName: 'Test' }),
      })
      const json = await res.json()

      expect(res.status).toBe(200)
      expect(json.success).toBe(true)
      expect(json.message).toContain('tự động lưu')
    })

    it('returns 401 for invalid token', async () => {
      mockValidateToken.mockResolvedValueOnce({ valid: false, error: 'EXPIRED_TOKEN' })

      const res = await app.request('/expense/expired/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(401)
    })

    it('returns 400 for negative values in draft', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())

      const res = await app.request('/expense/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ insurance: -50 }),
      })
      const json = await res.json()

      expect(res.status).toBe(400)
      expect(json.error).toBe('VALIDATION_ERROR')
    })

    it('accepts empty body for draft save', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const res = await app.request('/expense/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
    })

    it('saves vehicle info in draft', async () => {
      mockValidateToken.mockResolvedValueOnce(validToken())
      mockExpenseUpsert.mockResolvedValueOnce({} as any)

      const res = await app.request('/expense/valid-token/draft', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleMiles: 500,
          vehicleUsedForCommute: true,
        }),
      })

      expect(res.status).toBe(200)
      expect(mockExpenseUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            vehicleMiles: 500,
            vehicleUsedForCommute: true,
          }),
        })
      )
    })
  })
})
