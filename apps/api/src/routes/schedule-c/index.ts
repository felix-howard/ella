/**
 * Schedule C Staff API Routes
 * Authenticated endpoints for CPAs to manage Schedule C expense forms
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'
import {
  createMagicLink,
  createMagicLinkWithDeactivation,
  getScheduleCMagicLink,
  extendMagicLinkExpiry,
} from '../../services/magic-link'
import { sendScheduleCFormMessage, getOrgSmsLanguage } from '../../services/sms/message-sender'
import { calculateGrossReceipts, calculateScheduleCTotals, getGrossReceiptsBreakdown } from '../../services/schedule-c/expense-calculator'
import type { Prisma } from '@ella/db'

// Helper to format Decimal to string with 2 decimal places
const formatDecimal = (value: Prisma.Decimal | null): string | null =>
  value?.toFixed(2) ?? null

const scheduleCRoute = new Hono<{ Variables: AuthVariables }>()

/**
 * POST /schedule-c/:caseId/send
 * Send Schedule C expense form to client
 */
scheduleCRoute.post('/:caseId/send', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists and has phone
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      scheduleCExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  if (!taxCase.client.phone) {
    return c.json({ error: 'NO_PHONE', message: 'Client không có số điện thoại' }, 400)
  }

  // Check if already locked
  if (taxCase.scheduleCExpense?.status === 'LOCKED') {
    return c.json({ error: 'ALREADY_LOCKED', message: 'Form đã bị khóa' }, 400)
  }

  // Calculate prefilled gross receipts from verified 1099-NECs
  const prefilledGrossReceipts = await calculateGrossReceipts(caseId)

  // Upsert ScheduleCExpense (create if not exists, update grossReceipts if exists)
  const expense = await prisma.scheduleCExpense.upsert({
    where: { taxCaseId: caseId },
    create: {
      taxCaseId: caseId,
      status: 'DRAFT',
      grossReceipts: prefilledGrossReceipts.isZero() ? null : prefilledGrossReceipts,
    },
    update: {
      // Only update grossReceipts if currently null (don't overwrite client input)
      ...(taxCase.scheduleCExpense?.grossReceipts === null && {
        grossReceipts: prefilledGrossReceipts.isZero() ? null : prefilledGrossReceipts,
      }),
    },
  })

  // Create new magic link with atomic deactivation of existing links
  const { url: magicLinkUrl, expiresAt } = await createMagicLinkWithDeactivation(caseId, 'SCHEDULE_C')

  // Send SMS using org language preference
  const user = c.get('user')
  const smsLanguage = await getOrgSmsLanguage(user.organizationId)
  const smsResult = await sendScheduleCFormMessage(
    caseId,
    taxCase.client.name,
    taxCase.client.phone,
    magicLinkUrl,
    smsLanguage
  )

  return c.json({
    success: true,
    magicLink: magicLinkUrl,
    messageSent: smsResult.smsSent,
    expiresAt: expiresAt.toISOString(),
    expenseId: expense.id,
    prefilledGrossReceipts: prefilledGrossReceipts.toFixed(2),
  })
})

/**
 * GET /schedule-c/:caseId
 * Fetch Schedule C data for staff view
 */
scheduleCRoute.get('/:caseId', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      scheduleCExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  // Get 1099-NEC payer breakdown (single query, reused for total)
  const necBreakdown = await getGrossReceiptsBreakdown(caseId)

  // Auto-update grossReceipts if DRAFT or SUBMITTED (handles new 1099-NEC verified after send)
  // Only LOCKED forms are immutable
  if (taxCase.scheduleCExpense && taxCase.scheduleCExpense.status !== 'LOCKED') {
    const currentGross = await calculateGrossReceipts(caseId, necBreakdown)
    const storedGross = taxCase.scheduleCExpense.grossReceipts
    if (!storedGross || !currentGross.equals(storedGross)) {
      // Use optimistic locking: only update if not LOCKED (prevents race)
      await prisma.scheduleCExpense.updateMany({
        where: { id: taxCase.scheduleCExpense.id, status: { not: 'LOCKED' } },
        data: { grossReceipts: currentGross.isZero() ? null : currentGross },
      })
      taxCase.scheduleCExpense.grossReceipts = currentGross.isZero() ? null : currentGross
    }
  }

  // Get Schedule C magic link
  const magicLink = await prisma.magicLink.findFirst({
    where: {
      caseId,
      type: 'SCHEDULE_C',
    },
    orderBy: { createdAt: 'desc' },
  })

  // Calculate totals if expense exists
  let totals = null
  if (taxCase.scheduleCExpense) {
    const calculatedTotals = calculateScheduleCTotals(taxCase.scheduleCExpense)
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

  return c.json({
    expense: taxCase.scheduleCExpense
      ? {
          ...taxCase.scheduleCExpense,
          // Convert Decimal fields to strings with 2 decimal places
          grossReceipts: formatDecimal(taxCase.scheduleCExpense.grossReceipts),
          returns: formatDecimal(taxCase.scheduleCExpense.returns),
          costOfGoods: formatDecimal(taxCase.scheduleCExpense.costOfGoods),
          otherIncome: formatDecimal(taxCase.scheduleCExpense.otherIncome),
          advertising: formatDecimal(taxCase.scheduleCExpense.advertising),
          carExpense: formatDecimal(taxCase.scheduleCExpense.carExpense),
          commissions: formatDecimal(taxCase.scheduleCExpense.commissions),
          contractLabor: formatDecimal(taxCase.scheduleCExpense.contractLabor),
          depletion: formatDecimal(taxCase.scheduleCExpense.depletion),
          depreciation: formatDecimal(taxCase.scheduleCExpense.depreciation),
          employeeBenefits: formatDecimal(taxCase.scheduleCExpense.employeeBenefits),
          insurance: formatDecimal(taxCase.scheduleCExpense.insurance),
          interestMortgage: formatDecimal(taxCase.scheduleCExpense.interestMortgage),
          interestOther: formatDecimal(taxCase.scheduleCExpense.interestOther),
          legalServices: formatDecimal(taxCase.scheduleCExpense.legalServices),
          officeExpense: formatDecimal(taxCase.scheduleCExpense.officeExpense),
          pensionPlans: formatDecimal(taxCase.scheduleCExpense.pensionPlans),
          rentEquipment: formatDecimal(taxCase.scheduleCExpense.rentEquipment),
          rentProperty: formatDecimal(taxCase.scheduleCExpense.rentProperty),
          repairs: formatDecimal(taxCase.scheduleCExpense.repairs),
          supplies: formatDecimal(taxCase.scheduleCExpense.supplies),
          taxesAndLicenses: formatDecimal(taxCase.scheduleCExpense.taxesAndLicenses),
          travel: formatDecimal(taxCase.scheduleCExpense.travel),
          meals: formatDecimal(taxCase.scheduleCExpense.meals),
          utilities: formatDecimal(taxCase.scheduleCExpense.utilities),
          wages: formatDecimal(taxCase.scheduleCExpense.wages),
          otherExpenses: formatDecimal(taxCase.scheduleCExpense.otherExpenses),
          customExpenses: taxCase.scheduleCExpense.customExpenses ?? [],
          createdAt: taxCase.scheduleCExpense.createdAt.toISOString(),
          updatedAt: taxCase.scheduleCExpense.updatedAt.toISOString(),
          submittedAt: taxCase.scheduleCExpense.submittedAt?.toISOString() ?? null,
          lockedAt: taxCase.scheduleCExpense.lockedAt?.toISOString() ?? null,
          vehicleDateInService: taxCase.scheduleCExpense.vehicleDateInService?.toISOString() ?? null,
        }
      : null,
    magicLink: magicLink
      ? {
          id: magicLink.id,
          token: magicLink.token,
          isActive: magicLink.isActive,
          expiresAt: magicLink.expiresAt?.toISOString() ?? null,
          lastUsedAt: magicLink.lastUsedAt?.toISOString() ?? null,
          usageCount: magicLink.usageCount,
        }
      : null,
    totals,
    necBreakdown,
  })
})

/**
 * PATCH /schedule-c/:caseId/lock
 * Lock form to prevent client edits
 */
scheduleCRoute.patch('/:caseId/lock', async (c) => {
  const caseId = c.req.param('caseId')
  const user = c.get('user')

  // Get Schedule C expense
  const expense = await prisma.scheduleCExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  if (!expense) {
    return c.json({ error: 'NOT_FOUND', message: 'Schedule C không tồn tại' }, 404)
  }

  if (expense.status === 'LOCKED') {
    return c.json({ error: 'ALREADY_LOCKED', message: 'Form đã bị khóa' }, 400)
  }

  if (expense.status === 'DRAFT') {
    return c.json({ error: 'NOT_SUBMITTED', message: 'Form chưa được gửi bởi khách hàng' }, 400)
  }

  // Lock expense and deactivate magic link
  const lockedAt = new Date()
  await prisma.$transaction([
    prisma.scheduleCExpense.update({
      where: { id: expense.id },
      data: {
        status: 'LOCKED',
        lockedAt,
        lockedById: user?.staffId ?? null,
      },
    }),
    // Deactivate all Schedule C magic links for this case
    prisma.magicLink.updateMany({
      where: {
        caseId,
        type: 'SCHEDULE_C',
        isActive: true,
      },
      data: { isActive: false },
    }),
  ])

  return c.json({
    success: true,
    status: 'LOCKED',
    lockedAt: lockedAt.toISOString(),
  })
})

/**
 * POST /schedule-c/:caseId/resend
 * Resend form link (extend TTL)
 */
scheduleCRoute.post('/:caseId/resend', async (c) => {
  const caseId = c.req.param('caseId')

  // Validate taxCase exists and has phone
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: {
      client: true,
      scheduleCExpense: true,
    },
  })

  if (!taxCase) {
    return c.json({ error: 'CASE_NOT_FOUND', message: 'Case không tồn tại' }, 404)
  }

  if (!taxCase.client.phone) {
    return c.json({ error: 'NO_PHONE', message: 'Client không có số điện thoại' }, 400)
  }

  // Check if locked
  if (taxCase.scheduleCExpense?.status === 'LOCKED') {
    return c.json({ error: 'FORM_LOCKED', message: 'Form đã bị khóa, không thể gửi lại' }, 400)
  }

  // Get existing active magic link
  const magicLink = await getScheduleCMagicLink(caseId)
  let magicLinkUrl: string

  // Get org SMS language preference
  const user = c.get('user')
  const smsLanguage = await getOrgSmsLanguage(user.organizationId)

  if (magicLink) {
    // Extend existing link TTL
    const newExpiry = await extendMagicLinkExpiry(magicLink.id)
    magicLinkUrl = `${process.env.PORTAL_URL || 'http://localhost:5173'}/expense/${magicLink.token}`

    // Send SMS
    const smsResult = await sendScheduleCFormMessage(
      caseId,
      taxCase.client.name,
      taxCase.client.phone,
      magicLinkUrl,
      smsLanguage
    )

    return c.json({
      success: true,
      expiresAt: newExpiry.toISOString(),
      messageSent: smsResult.smsSent,
    })
  } else {
    // No existing link, create new one (same as /send)
    magicLinkUrl = await createMagicLink(caseId, { type: 'SCHEDULE_C' })
    const newLink = await getScheduleCMagicLink(caseId)

    // Send SMS
    const smsResult = await sendScheduleCFormMessage(
      caseId,
      taxCase.client.name,
      taxCase.client.phone,
      magicLinkUrl,
      smsLanguage
    )

    return c.json({
      success: true,
      expiresAt: newLink?.expiresAt?.toISOString() ?? null,
      messageSent: smsResult.smsSent,
    })
  }
})

/**
 * PATCH /schedule-c/:caseId/unlock
 * Unlock a locked form (if needed)
 */
scheduleCRoute.patch('/:caseId/unlock', async (c) => {
  const caseId = c.req.param('caseId')

  const expense = await prisma.scheduleCExpense.findUnique({
    where: { taxCaseId: caseId },
  })

  if (!expense) {
    return c.json({ error: 'NOT_FOUND', message: 'Schedule C không tồn tại' }, 404)
  }

  if (expense.status !== 'LOCKED') {
    return c.json({ error: 'NOT_LOCKED', message: 'Form không bị khóa' }, 400)
  }

  // Unlock expense
  await prisma.scheduleCExpense.update({
    where: { id: expense.id },
    data: {
      status: 'SUBMITTED',
      lockedAt: null,
      lockedById: null,
    },
  })

  return c.json({
    success: true,
    status: 'SUBMITTED',
  })
})

export { scheduleCRoute }
