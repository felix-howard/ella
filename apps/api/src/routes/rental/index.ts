/**
 * Public Rental Form API Routes
 * No-auth endpoints for clients to view and submit Schedule E rental data
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import { validateScheduleEToken } from '../../services/magic-link'
import {
  calculateScheduleETotals,
  recalculateAllTotals,
} from '../../services/schedule-e/expense-calculator'
import {
  createVersionEntry,
  appendVersionHistory,
} from '../../services/schedule-e/version-history'
import { scheduleEFormSchema, scheduleEDraftSchema } from '../schedule-e/schemas'
import type { ScheduleEProperty } from '@ella/shared'
import type { Prisma } from '@ella/db'

const rentalRoute = new Hono()

// Error messages in Vietnamese
const ERROR_MESSAGES: Record<string, string> = {
  INVALID_TOKEN: 'Link không hợp lệ. Vui lòng liên hệ văn phòng thuế.',
  INVALID_TOKEN_TYPE: 'Link không dành cho form nhà cho thuê. Vui lòng liên hệ văn phòng thuế.',
  LINK_DEACTIVATED: 'Link đã bị vô hiệu hóa. Vui lòng liên hệ văn phòng thuế.',
  EXPIRED_TOKEN: 'Link đã hết hạn. Vui lòng liên hệ văn phòng thuế để được gửi link mới.',
  FORM_LOCKED: 'Form đã bị khóa bởi CPA. Không thể chỉnh sửa.',
  VALIDATION_ERROR: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra lại.',
}

// Helper to get localized error message
const getErrorMessage = (errorCode: string): string =>
  ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.INVALID_TOKEN

/**
 * GET /rental/:token
 * Validate token & fetch form data for client
 */
rentalRoute.get('/:token', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule E token
  const validation = await validateScheduleEToken(token)

  if (!validation.valid) {
    return c.json(
      { error: validation.error, message: getErrorMessage(validation.error!) },
      401
    )
  }

  const { caseId, clientName, clientLanguage, taxYear } = validation

  // Get existing Schedule E expense (may be null if first access)
  const expense = await prisma.scheduleEExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  // Calculate totals if expense exists with properties
  let totals = null
  if (expense) {
    const properties = (expense.properties as unknown as ScheduleEProperty[]) || []
    if (properties.length > 0) {
      totals = calculateScheduleETotals(properties)
    }
  }

  return c.json({
    client: {
      name: clientName,
      language: clientLanguage,
    },
    taxYear,
    expense: expense
      ? {
          id: expense.id,
          status: expense.status,
          version: expense.version,
          properties: expense.properties ?? [],
        }
      : null,
    totals,
  })
})

/**
 * POST /rental/:token/submit
 * Submit form data (creates version history)
 */
rentalRoute.post('/:token/submit', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule E token
  const validation = await validateScheduleEToken(token)

  if (!validation.valid) {
    return c.json(
      { error: validation.error, message: getErrorMessage(validation.error!) },
      401
    )
  }

  const { caseId } = validation

  // Parse and validate request body
  const body = await c.req.json()
  const parseResult = scheduleEFormSchema.safeParse(body)

  if (!parseResult.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: getErrorMessage('VALIDATION_ERROR'),
        details: parseResult.error.flatten(),
      },
      400
    )
  }

  const data = parseResult.data

  // Recalculate totals for all properties
  const propertiesWithTotals = recalculateAllTotals(
    data.properties.map(p => ({
      ...p,
      propertyTypeOther: p.propertyTypeOther ?? undefined,
    }))
  )

  // Get existing expense (if any)
  const existingExpense = await prisma.scheduleEExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  // Determine new version and status
  const isFirstSubmit = !existingExpense || existingExpense.status === 'DRAFT'
  const newVersion = isFirstSubmit ? 1 : (existingExpense?.version ?? 0) + 1

  // Create/update expense with version history
  if (!existingExpense) {
    // Create new expense (first submission)
    const newExpense = await prisma.scheduleEExpense.create({
      data: {
        taxCaseId: caseId!,
        properties: propertiesWithTotals as unknown as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        version: 1,
        submittedAt: new Date(),
        versionHistory: [],
      },
    })

    // Create initial version entry
    const versionEntry = createVersionEntry(propertiesWithTotals, [], 1)
    await prisma.scheduleEExpense.update({
      where: { id: newExpense.id },
      data: { versionHistory: [versionEntry] as unknown as Prisma.InputJsonValue },
    })
  } else {
    // Update existing expense
    const previousProperties = (existingExpense.properties as unknown as ScheduleEProperty[]) || []
    const isStatusChange = existingExpense.status === 'DRAFT'

    await prisma.scheduleEExpense.update({
      where: { id: existingExpense.id },
      data: {
        properties: propertiesWithTotals as unknown as Prisma.InputJsonValue,
        status: 'SUBMITTED',
        version: newVersion,
        ...(isStatusChange && { submittedAt: new Date() }),
      },
    })

    // Create version entry only for resubmissions (not DRAFT -> SUBMITTED first time)
    if (!isStatusChange) {
      const versionEntry = createVersionEntry(propertiesWithTotals, previousProperties, newVersion)
      const newHistory = appendVersionHistory(existingExpense.versionHistory, versionEntry)
      await prisma.scheduleEExpense.update({
        where: { id: existingExpense.id },
        data: { versionHistory: newHistory as unknown as Prisma.InputJsonValue },
      })
    } else {
      // First submission - create initial version entry
      const versionEntry = createVersionEntry(propertiesWithTotals, [], 1)
      await prisma.scheduleEExpense.update({
        where: { id: existingExpense.id },
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
 * PATCH /rental/:token/draft
 * Auto-save draft (no version history)
 */
rentalRoute.patch('/:token/draft', async (c) => {
  const token = c.req.param('token')

  // Validate Schedule E token
  const validation = await validateScheduleEToken(token)

  if (!validation.valid) {
    return c.json(
      { error: validation.error, message: getErrorMessage(validation.error!) },
      401
    )
  }

  const { caseId } = validation

  // Parse and validate request body (draft schema is more lenient)
  const body = await c.req.json()
  const parseResult = scheduleEDraftSchema.safeParse(body)

  if (!parseResult.success) {
    return c.json(
      {
        error: 'VALIDATION_ERROR',
        message: getErrorMessage('VALIDATION_ERROR'),
        details: parseResult.error.flatten(),
      },
      400
    )
  }

  const data = parseResult.data
  const properties = data.properties || []

  // Upsert expense without changing status or creating version history
  await prisma.scheduleEExpense.upsert({
    where: { taxCaseId: caseId! },
    create: {
      taxCaseId: caseId!,
      properties: properties as unknown as Prisma.InputJsonValue,
      status: 'DRAFT',
      version: 0,
    },
    update: {
      properties: properties as unknown as Prisma.InputJsonValue,
    },
  })

  return c.json({
    success: true,
    message: 'Đã tự động lưu.',
  })
})

export { rentalRoute }
