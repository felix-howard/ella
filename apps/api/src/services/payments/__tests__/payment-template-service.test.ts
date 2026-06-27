import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  paymentTemplate: {
    findMany: vi.fn(),
    create: vi.fn(),
    updateManyAndReturn: vi.fn(),
    findFirst: vi.fn(),
  },
}))

const quoteMocks = vi.hoisted(() => ({
  buildCustomQuote: vi.fn(),
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))
vi.mock('../../stripe/custom-quote-builder', () => quoteMocks)

import {
  archivePaymentTemplate,
  createPaymentTemplate,
  listPaymentTemplates,
  updatePaymentTemplate,
} from '../payment-template-service'
import type { CreatePaymentTemplateInput } from '../../../routes/billing/schemas'

const context = { organizationId: 'org_1', staffId: 'staff_1' }
const now = new Date('2026-06-12T08:00:00.000Z')

function buildInput(overrides: Partial<CreatePaymentTemplateInput> = {}): CreatePaymentTemplateInput {
  return {
    name: 'Monthly bookkeeping',
    description: 'Standard monthly package',
    template: {
      billingInterval: 'month',
      items: [
        {
          label: ' Bookkeeping \n Cleanup ',
          description: ' Monthly close \n\n Tax review ',
          unitAmountCents: 50000,
          quantity: 1,
        },
      ],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
    },
    ...overrides,
  }
}

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'template_1',
    organizationId: 'org_1',
    name: 'Monthly bookkeeping',
    description: 'Standard monthly package',
    items: buildInput().template,
    createdByStaffId: 'staff_1',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('payment-template-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    quoteMocks.buildCustomQuote.mockReturnValue({
      quote: {},
      lineItems: [],
      billingInterval: 'month',
    })
  })

  it('lists active org templates as frontend summaries', async () => {
    prismaMocks.paymentTemplate.findMany.mockResolvedValue([
      buildRow({
        items: {
          billingInterval: 'one_time',
          items: [{ label: 'Tax return', unitAmountCents: 30000, quantity: 2 }],
        },
      }),
    ])

    const result = await listPaymentTemplates('org_1')

    expect(prismaMocks.paymentTemplate.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1', archivedAt: null },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    })
    expect(result).toEqual([
      expect.objectContaining({
        id: 'template_1',
        itemCount: 1,
        totalCents: 60000,
        createdAt: now.toISOString(),
      }),
    ])
  })

  it('creates a normalized template after custom quote validation', async () => {
    prismaMocks.paymentTemplate.create.mockResolvedValue(buildRow())

    await createPaymentTemplate(buildInput(), context)

    expect(quoteMocks.buildCustomQuote).toHaveBeenCalledWith({
      billingInterval: 'month',
      items: [
        {
          label: 'Bookkeeping Cleanup',
          description: 'Monthly close\nTax review',
          unitAmountCents: 50000,
          quantity: 1,
        },
      ],
      oneTimeItems: [{ label: 'Setup', unitAmountCents: 25000, quantity: 1 }],
    })
    expect(prismaMocks.paymentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org_1',
        createdByStaffId: 'staff_1',
        name: 'Monthly bookkeeping',
        description: 'Standard monthly package',
        items: expect.objectContaining({ billingInterval: 'month' }),
      }),
    })
  })

  it('maps duplicate active names to a stable conflict error', async () => {
    prismaMocks.paymentTemplate.create.mockRejectedValue({ code: 'P2002' })

    await expect(createPaymentTemplate(buildInput(), context)).rejects.toMatchObject({
      code: 'PAYMENT_TEMPLATE_DUPLICATE',
      status: 409,
    })
  })

  it('updates only active templates scoped to the organization', async () => {
    prismaMocks.paymentTemplate.updateManyAndReturn.mockResolvedValue([buildRow({ name: 'Updated' })])

    const result = await updatePaymentTemplate(
      'template_1',
      { name: ' Updated ', description: '' },
      context,
    )

    expect(prismaMocks.paymentTemplate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: 'template_1', organizationId: 'org_1', archivedAt: null },
      data: { name: 'Updated', description: null },
    })
    expect(result.name).toBe('Updated')
  })

  it('returns not found when an org-scoped update touches no row', async () => {
    prismaMocks.paymentTemplate.updateManyAndReturn.mockResolvedValue([])

    await expect(updatePaymentTemplate('other_org_template', { name: 'X' }, context)).rejects.toMatchObject({
      code: 'PAYMENT_TEMPLATE_NOT_FOUND',
      status: 404,
    })
  })

  it('archives active templates instead of deleting them', async () => {
    prismaMocks.paymentTemplate.updateManyAndReturn.mockResolvedValue([buildRow({ archivedAt: now })])

    await archivePaymentTemplate('template_1', context)

    expect(prismaMocks.paymentTemplate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: 'template_1', organizationId: 'org_1', archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    })
  })
})
