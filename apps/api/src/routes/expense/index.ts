/**
 * Public Expense Form API Routes
 * No-auth endpoints for clients to view and submit Schedule C expense data
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateScheduleCToken } from '../../services/magic-link'
import { calculateGrossReceipts, calculateScheduleCTotals } from '../../services/schedule-c/expense-calculator'
import {
  createExpenseSnapshot,
  createVersionEntry,
  appendVersionHistory,
} from '../../services/schedule-c/version-history'
import { expenseSubmitSchema, expenseDraftSchema } from './schemas'
import { Prisma } from '@ella/db'

const PrismaDecimal = Prisma.Decimal

// Helper to format Decimal to string with 2 decimal places
const formatDecimal = (value: Prisma.Decimal | null): string | null =>
  value?.toFixed(2) ?? null

const expenseRoute = new Hono()

// Error messages in Vietnamese
const ERROR_MESSAGES = {
  INVALID_TOKEN: 'Link không hợp lệ. Vui lòng liên hệ văn phòng thuế.',
  INVALID_TOKEN_TYPE: 'Link không dành cho form chi phí. Vui lòng liên hệ văn phòng thuế.',
  LINK_DEACTIVATED: 'Link đã bị vô hiệu hóa. Vui lòng liên hệ văn phòng thuế.',
  EXPIRED_TOKEN: 'Link đã hết hạn. Vui lòng liên hệ văn phòng thuế để được gửi link mới.',
  FORM_LOCKED: 'Form đã bị khóa bởi CPA. Không thể chỉnh sửa.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
}

/**
 * GET /expense/:token
 * Validate token & fetch form data for client
 */
expenseRoute.get('/:token', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule C token
  const validation = await validateScheduleCToken(token)

  if (!validation.valid) {
    return c.json(
      {
        error: validation.error,
        message: ERROR_MESSAGES[validation.error as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.INVALID_TOKEN,
      },
      401
    )
  }

  const { caseId, clientName, clientLanguage, taxYear } = validation

  // Get existing Schedule C expense (may be null if first access)
  const expense = await prisma.scheduleCExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  // Calculate prefilled gross receipts from verified 1099-NECs
  const prefilledGrossReceipts = await calculateGrossReceipts(caseId!)

  // If expense exists, calculate totals
  let totals = null
  if (expense) {
    const calculatedTotals = calculateScheduleCTotals(expense)
    totals = {
      grossReceipts: calculatedTotals.grossReceipts.toFixed(2),
      returns: calculatedTotals.returns.toFixed(2),
      costOfGoods: calculatedTotals.costOfGoods.toFixed(2),
      grossIncome: calculatedTotals.grossIncome.toFixed(2),
      totalExpenses: calculatedTotals.totalExpenses.toFixed(2),
      mileageDeduction: calculatedTotals.mileageDeduction.toFixed(2),
      netProfit: calculatedTotals.netProfit.toFixed(2),
    }
  }

  // Convert expense Decimal fields to strings with 2 decimal places
  const expenseData = expense
    ? {
        id: expense.id,
        status: expense.status,
        version: expense.version,
        businessName: expense.businessName,
        businessDesc: expense.businessDesc,
        grossReceipts: formatDecimal(expense.grossReceipts),
        returns: formatDecimal(expense.returns),
        costOfGoods: formatDecimal(expense.costOfGoods),
        otherIncome: formatDecimal(expense.otherIncome),
        advertising: formatDecimal(expense.advertising),
        carExpense: formatDecimal(expense.carExpense),
        commissions: formatDecimal(expense.commissions),
        contractLabor: formatDecimal(expense.contractLabor),
        depletion: formatDecimal(expense.depletion),
        depreciation: formatDecimal(expense.depreciation),
        employeeBenefits: formatDecimal(expense.employeeBenefits),
        insurance: formatDecimal(expense.insurance),
        interestMortgage: formatDecimal(expense.interestMortgage),
        interestOther: formatDecimal(expense.interestOther),
        legalServices: formatDecimal(expense.legalServices),
        officeExpense: formatDecimal(expense.officeExpense),
        pensionPlans: formatDecimal(expense.pensionPlans),
        rentEquipment: formatDecimal(expense.rentEquipment),
        rentProperty: formatDecimal(expense.rentProperty),
        repairs: formatDecimal(expense.repairs),
        supplies: formatDecimal(expense.supplies),
        taxesAndLicenses: formatDecimal(expense.taxesAndLicenses),
        travel: formatDecimal(expense.travel),
        meals: formatDecimal(expense.meals),
        utilities: formatDecimal(expense.utilities),
        wages: formatDecimal(expense.wages),
        otherExpenses: formatDecimal(expense.otherExpenses),
        otherExpensesNotes: expense.otherExpensesNotes,
        vehicleMiles: expense.vehicleMiles,
        vehicleCommuteMiles: expense.vehicleCommuteMiles,
        vehicleOtherMiles: expense.vehicleOtherMiles,
        vehicleDateInService: expense.vehicleDateInService?.toISOString() ?? null,
        vehicleUsedForCommute: expense.vehicleUsedForCommute,
        vehicleAnotherAvailable: expense.vehicleAnotherAvailable,
        vehicleEvidenceWritten: expense.vehicleEvidenceWritten,
      }
    : null

  return c.json({
    client: {
      name: clientName,
      language: clientLanguage,
    },
    taxYear,
    expense: expenseData,
    prefilledGrossReceipts: prefilledGrossReceipts.toFixed(2),
    totals,
  })
})

/**
 * POST /expense/:token
 * Submit/update expense data (creates version history)
 */
expenseRoute.post('/:token', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule C token
  const validation = await validateScheduleCToken(token)

  if (!validation.valid) {
    return c.json(
      {
        error: validation.error,
        message: ERROR_MESSAGES[validation.error as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.INVALID_TOKEN,
      },
      401
    )
  }

  const { caseId } = validation

  // Parse and validate request body
  const body = await c.req.json()
  const parseResult = expenseSubmitSchema.safeParse(body)

  if (!parseResult.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        details: parseResult.error.flatten(),
      },
      400
    )
  }

  const data = parseResult.data

  // Get existing expense (if any)
  const existingExpense = await prisma.scheduleCExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  // Prepare data for Prisma (convert numbers to Decimal)
  const prepareDecimal = (value: number | null | undefined) =>
    value !== null && value !== undefined ? new PrismaDecimal(value) : null

  const expenseData = {
    businessName: data.businessName,
    businessDesc: data.businessDesc,
    grossReceipts: prepareDecimal(data.grossReceipts),
    returns: prepareDecimal(data.returns),
    costOfGoods: prepareDecimal(data.costOfGoods),
    otherIncome: prepareDecimal(data.otherIncome),
    advertising: prepareDecimal(data.advertising),
    carExpense: prepareDecimal(data.carExpense),
    commissions: prepareDecimal(data.commissions),
    contractLabor: prepareDecimal(data.contractLabor),
    depletion: prepareDecimal(data.depletion),
    depreciation: prepareDecimal(data.depreciation),
    employeeBenefits: prepareDecimal(data.employeeBenefits),
    insurance: prepareDecimal(data.insurance),
    interestMortgage: prepareDecimal(data.interestMortgage),
    interestOther: prepareDecimal(data.interestOther),
    legalServices: prepareDecimal(data.legalServices),
    officeExpense: prepareDecimal(data.officeExpense),
    pensionPlans: prepareDecimal(data.pensionPlans),
    rentEquipment: prepareDecimal(data.rentEquipment),
    rentProperty: prepareDecimal(data.rentProperty),
    repairs: prepareDecimal(data.repairs),
    supplies: prepareDecimal(data.supplies),
    taxesAndLicenses: prepareDecimal(data.taxesAndLicenses),
    travel: prepareDecimal(data.travel),
    meals: prepareDecimal(data.meals),
    utilities: prepareDecimal(data.utilities),
    wages: prepareDecimal(data.wages),
    otherExpenses: prepareDecimal(data.otherExpenses),
    otherExpensesNotes: data.otherExpensesNotes,
    vehicleMiles: data.vehicleMiles,
    vehicleCommuteMiles: data.vehicleCommuteMiles,
    vehicleOtherMiles: data.vehicleOtherMiles,
    vehicleDateInService: data.vehicleDateInService ? new Date(data.vehicleDateInService) : null,
    vehicleUsedForCommute: data.vehicleUsedForCommute ?? false,
    vehicleAnotherAvailable: data.vehicleAnotherAvailable ?? false,
    vehicleEvidenceWritten: data.vehicleEvidenceWritten ?? false,
  }

  // Determine new version and status
  const isFirstSubmit = !existingExpense || existingExpense.status === 'DRAFT'
  const newVersion = isFirstSubmit ? 1 : (existingExpense?.version ?? 0) + 1

  // Create/update expense with version history
  let updatedExpense
  if (!existingExpense) {
    // Create new expense (first submission)
    updatedExpense = await prisma.scheduleCExpense.create({
      data: {
        taxCaseId: caseId!,
        ...expenseData,
        status: 'SUBMITTED',
        version: 1,
        submittedAt: new Date(),
        versionHistory: [],
      },
    })

    // Create initial version entry
    const versionEntry = createVersionEntry(updatedExpense, null, 1)
    await prisma.scheduleCExpense.update({
      where: { id: updatedExpense.id },
      data: { versionHistory: [versionEntry] as unknown as Prisma.InputJsonValue },
    })
  } else {
    // Update existing expense
    const previousSnapshot = createExpenseSnapshot(existingExpense)
    const isStatusChange = existingExpense.status === 'DRAFT'

    updatedExpense = await prisma.scheduleCExpense.update({
      where: { id: existingExpense.id },
      data: {
        ...expenseData,
        status: 'SUBMITTED',
        version: newVersion,
        ...(isStatusChange && { submittedAt: new Date() }),
      },
    })

    // Create version entry only for SUBMITTED status (not for DRAFT -> SUBMITTED transition first time)
    if (!isStatusChange) {
      const versionEntry = createVersionEntry(updatedExpense, previousSnapshot, newVersion)
      const newHistory = appendVersionHistory(existingExpense.versionHistory, versionEntry)
      await prisma.scheduleCExpense.update({
        where: { id: updatedExpense.id },
        data: { versionHistory: newHistory as unknown as Prisma.InputJsonValue },
      })
    } else {
      // First submission - create initial version entry
      const versionEntry = createVersionEntry(updatedExpense, null, 1)
      await prisma.scheduleCExpense.update({
        where: { id: updatedExpense.id },
        data: { versionHistory: [versionEntry] as unknown as Prisma.InputJsonValue },
      })
    }
  }

  return c.json({
    success: true,
    version: newVersion,
    status: 'SUBMITTED',
    message: 'Đã lưu thành công! CPA sẽ xem xét thông tin của bạn.',
  })
})

/**
 * PATCH /expense/:token/draft
 * Auto-save draft (no version history)
 */
expenseRoute.patch('/:token/draft', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule C token
  const validation = await validateScheduleCToken(token)

  if (!validation.valid) {
    return c.json(
      {
        error: validation.error,
        message: ERROR_MESSAGES[validation.error as keyof typeof ERROR_MESSAGES] || ERROR_MESSAGES.INVALID_TOKEN,
      },
      401
    )
  }

  const { caseId } = validation

  // Parse and validate request body
  const body = await c.req.json()
  const parseResult = expenseDraftSchema.safeParse(body)

  if (!parseResult.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: ERROR_MESSAGES.VALIDATION_ERROR,
        details: parseResult.error.flatten(),
      },
      400
    )
  }

  const data = parseResult.data

  // Prepare data for Prisma (convert numbers to Decimal)
  const prepareDecimal = (value: number | null | undefined) =>
    value !== null && value !== undefined ? new PrismaDecimal(value) : null

  const expenseData = {
    businessName: data.businessName,
    businessDesc: data.businessDesc,
    grossReceipts: prepareDecimal(data.grossReceipts),
    returns: prepareDecimal(data.returns),
    costOfGoods: prepareDecimal(data.costOfGoods),
    otherIncome: prepareDecimal(data.otherIncome),
    advertising: prepareDecimal(data.advertising),
    carExpense: prepareDecimal(data.carExpense),
    commissions: prepareDecimal(data.commissions),
    contractLabor: prepareDecimal(data.contractLabor),
    depletion: prepareDecimal(data.depletion),
    depreciation: prepareDecimal(data.depreciation),
    employeeBenefits: prepareDecimal(data.employeeBenefits),
    insurance: prepareDecimal(data.insurance),
    interestMortgage: prepareDecimal(data.interestMortgage),
    interestOther: prepareDecimal(data.interestOther),
    legalServices: prepareDecimal(data.legalServices),
    officeExpense: prepareDecimal(data.officeExpense),
    pensionPlans: prepareDecimal(data.pensionPlans),
    rentEquipment: prepareDecimal(data.rentEquipment),
    rentProperty: prepareDecimal(data.rentProperty),
    repairs: prepareDecimal(data.repairs),
    supplies: prepareDecimal(data.supplies),
    taxesAndLicenses: prepareDecimal(data.taxesAndLicenses),
    travel: prepareDecimal(data.travel),
    meals: prepareDecimal(data.meals),
    utilities: prepareDecimal(data.utilities),
    wages: prepareDecimal(data.wages),
    otherExpenses: prepareDecimal(data.otherExpenses),
    otherExpensesNotes: data.otherExpensesNotes,
    vehicleMiles: data.vehicleMiles,
    vehicleCommuteMiles: data.vehicleCommuteMiles,
    vehicleOtherMiles: data.vehicleOtherMiles,
    vehicleDateInService: data.vehicleDateInService ? new Date(data.vehicleDateInService) : null,
    vehicleUsedForCommute: data.vehicleUsedForCommute ?? false,
    vehicleAnotherAvailable: data.vehicleAnotherAvailable ?? false,
    vehicleEvidenceWritten: data.vehicleEvidenceWritten ?? false,
  }

  // Upsert expense without changing status or creating version history
  await prisma.scheduleCExpense.upsert({
    where: { taxCaseId: caseId! },
    create: {
      taxCaseId: caseId!,
      ...expenseData,
      status: 'DRAFT',
      version: 0,
    },
    update: expenseData,
  })

  return c.json({
    success: true,
    message: 'Đã tự động lưu.',
  })
})

export { expenseRoute }
