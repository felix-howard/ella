import type { PaymentTemplate, Prisma } from '@ella/db'
import { prisma } from '../../lib/db'
import type {
  CreatePaymentTemplateInput,
  PaymentTemplateItemsInput,
  UpdatePaymentTemplateInput,
} from '../../routes/billing/schemas'
import { buildCustomQuote } from '../stripe/custom-quote-builder'
import {
  normalizeLineItemDescription,
  normalizeLineItemLabel,
} from '../stripe/checkout-line-items'

export type PaymentTemplateErrorCode = 'PAYMENT_TEMPLATE_NOT_FOUND' | 'PAYMENT_TEMPLATE_DUPLICATE'

export class PaymentTemplateError extends Error {
  constructor(
    public readonly code: PaymentTemplateErrorCode,
    message: string,
    public readonly status: 404 | 409,
  ) {
    super(message)
    this.name = 'PaymentTemplateError'
  }
}

export interface PaymentTemplateContext {
  organizationId: string
  staffId: string
}

export interface PaymentTemplateSummary {
  id: string
  name: string
  description: string | null
  template: PaymentTemplateItemsInput
  itemCount: number
  totalCents: number
  createdAt: string
  updatedAt: string
}

export async function listPaymentTemplates(
  organizationId: string,
): Promise<PaymentTemplateSummary[]> {
  const templates = await prisma.paymentTemplate.findMany({
    where: { organizationId, archivedAt: null },
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  })
  return templates.map(serializePaymentTemplate)
}

export async function createPaymentTemplate(
  input: CreatePaymentTemplateInput,
  context: PaymentTemplateContext,
): Promise<PaymentTemplateSummary> {
  const template = normalizeTemplate(input.template)
  validateTemplate(template)

  try {
    const created = await prisma.paymentTemplate.create({
      data: {
        organizationId: context.organizationId,
        createdByStaffId: context.staffId,
        name: input.name.trim(),
        description: normalizeDescription(input.description),
        items: template as unknown as Prisma.InputJsonValue,
      },
    })
    return serializePaymentTemplate(created)
  } catch (error) {
    throw mapDuplicateName(error)
  }
}

export async function updatePaymentTemplate(
  id: string,
  input: UpdatePaymentTemplateInput,
  context: PaymentTemplateContext,
): Promise<PaymentTemplateSummary> {
  const data: Prisma.PaymentTemplateUpdateManyMutationInput = {}
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.description !== undefined) data.description = normalizeDescription(input.description)
  if (input.template !== undefined) {
    const template = normalizeTemplate(input.template)
    validateTemplate(template)
    data.items = template as unknown as Prisma.InputJsonValue
  }

  try {
    const updated = await prisma.paymentTemplate.updateManyAndReturn({
      where: { id, organizationId: context.organizationId, archivedAt: null },
      data,
    })
    if (updated.length !== 1) throw notFound()
    return serializePaymentTemplate(updated[0])
  } catch (error) {
    throw mapDuplicateName(error)
  }
}

export async function archivePaymentTemplate(
  id: string,
  context: PaymentTemplateContext,
): Promise<PaymentTemplateSummary> {
  const archived = await prisma.paymentTemplate.updateManyAndReturn({
    where: { id, organizationId: context.organizationId, archivedAt: null },
    data: { archivedAt: new Date() },
  })
  if (archived.length !== 1) throw notFound()
  return serializePaymentTemplate(archived[0])
}

function serializePaymentTemplate(template: PaymentTemplate): PaymentTemplateSummary {
  const items = normalizeTemplate(template.items as unknown as PaymentTemplateItemsInput)
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    template: items,
    itemCount: countItems(items),
    totalCents: sumTemplateCents(items),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}

function normalizeTemplate(input: PaymentTemplateItemsInput): PaymentTemplateItemsInput {
  const oneTimeItems = input.oneTimeItems?.map(normalizeLineItem) ?? []
  return {
    billingInterval: input.billingInterval,
    items: input.items.map(normalizeLineItem),
    ...(oneTimeItems.length ? { oneTimeItems } : {}),
  }
}

function normalizeLineItem(item: PaymentTemplateItemsInput['items'][number]) {
  const description = normalizeLineItemDescription(item.description)
  return {
    label: normalizeLineItemLabel(item.label),
    ...(description ? { description } : {}),
    unitAmountCents: item.unitAmountCents,
    quantity: item.quantity,
  }
}

function validateTemplate(template: PaymentTemplateItemsInput): void {
  buildCustomQuote(template)
}

function countItems(template: PaymentTemplateItemsInput): number {
  return template.items.length + (template.oneTimeItems?.length ?? 0)
}

function sumTemplateCents(template: PaymentTemplateItemsInput): number {
  return [...template.items, ...(template.oneTimeItems ?? [])].reduce(
    (sum, item) => sum + item.unitAmountCents * item.quantity,
    0,
  )
}

function normalizeDescription(description: string | null | undefined): string | null {
  const trimmed = description?.trim()
  return trimmed || null
}

function notFound(): PaymentTemplateError {
  return new PaymentTemplateError(
    'PAYMENT_TEMPLATE_NOT_FOUND',
    'Payment template not found',
    404,
  )
}

function mapDuplicateName(error: unknown): never {
  if (isPrismaUniqueError(error)) {
    throw new PaymentTemplateError(
      'PAYMENT_TEMPLATE_DUPLICATE',
      'A payment template with this name already exists',
      409,
    )
  }
  throw error
}

function isPrismaUniqueError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')
}
