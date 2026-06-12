import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  paymentTemplate: {
    create: vi.fn(),
    updateManyAndReturn: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

import { archivePaymentTemplate, createPaymentTemplate } from '../payment-template-service'
import type { CreatePaymentTemplateInput } from '../../../routes/billing/schemas'

const context = { organizationId: 'org_1', staffId: 'staff_1' }
const now = new Date('2026-06-12T08:00:00.000Z')

function buildRow(items: CreatePaymentTemplateInput['template']) {
  return {
    id: 'template_1',
    organizationId: 'org_1',
    name: 'Annual return',
    description: null,
    items,
    createdByStaffId: 'staff_1',
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
  }
}

describe('payment-template-service validation edges', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates a one-time template with valid rows', async () => {
    const input: CreatePaymentTemplateInput = {
      name: ' Annual return ',
      template: {
        billingInterval: 'one_time',
        items: [{ label: 'Tax return', unitAmountCents: 75000, quantity: 1 }],
      },
    }
    prismaMocks.paymentTemplate.create.mockResolvedValue(buildRow(input.template))

    const result = await createPaymentTemplate(input, context)

    expect(prismaMocks.paymentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Annual return',
        items: input.template,
      }),
    })
    expect(result).toMatchObject({ name: 'Annual return', itemCount: 1, totalCents: 75000 })
  })

  it('rejects line items that fail real custom quote validation before inserting', async () => {
    await expect(
      createPaymentTemplate(
        {
          name: 'Invalid',
          template: {
            billingInterval: 'one_time',
            items: [{ label: 'Tax return', unitAmountCents: 0, quantity: 1 }],
          },
        },
        context
      )
    ).rejects.toThrow('Line item amount must be between 1 cent and $1,000,000')

    expect(prismaMocks.paymentTemplate.create).not.toHaveBeenCalled()
  })

  it('returns not found when archiving another organization template', async () => {
    prismaMocks.paymentTemplate.updateManyAndReturn.mockResolvedValue([])

    await expect(archivePaymentTemplate('template_other_org', context)).rejects.toMatchObject({
      code: 'PAYMENT_TEMPLATE_NOT_FOUND',
      status: 404,
    })
    expect(prismaMocks.paymentTemplate.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: 'template_other_org', organizationId: 'org_1', archivedAt: null },
      data: { archivedAt: expect.any(Date) },
    })
  })
})
