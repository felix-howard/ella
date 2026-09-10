import type { Prisma, PricingQuoteDraft } from '@ella/db'
import {
  calculatePricing,
  materializePricingSetupRates,
  type PricingCalculatorInput,
} from '@ella/shared/pricing'
import { prisma } from '../../lib/db'
import type {
  CreatePricingQuoteDraftInput,
  PricingQuoteDraftInput,
  UpdatePricingQuoteDraftInput,
} from '../../routes/billing/schemas'
import { pricingQuoteDraftInputSchema } from '../../routes/billing/schemas'

export type PricingQuoteDraftErrorCode =
  | 'PRICING_QUOTE_DRAFT_NOT_FOUND'
  | 'PRICING_QUOTE_DRAFT_DUPLICATE'
  | 'PRICING_QUOTE_DRAFT_CONFLICT'
  | 'PRICING_QUOTE_DRAFT_TOTAL_INVALID'

export class PricingQuoteDraftError extends Error {
  constructor(
    public readonly code: PricingQuoteDraftErrorCode,
    message: string,
    public readonly status: 400 | 404 | 409
  ) {
    super(message)
    this.name = 'PricingQuoteDraftError'
  }
}

export interface PricingQuoteDraftSummary {
  id: string
  name: string
  monthlyTotalCents: number
  setupTotalCents: number
  createdAt: string
  updatedAt: string
}

export interface PricingQuoteDraftDetail extends PricingQuoteDraftSummary {
  pricingInput: PricingQuoteDraftInput
}

export type PricingQuoteDraftConsumeStatus =
  | 'consumed'
  | 'already_absent'
  | 'version_conflict'

export async function listPricingQuoteDrafts(
  organizationId: string
): Promise<PricingQuoteDraftSummary[]> {
  const drafts = await prisma.pricingQuoteDraft.findMany({
    where: { organizationId },
    orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
  })
  return drafts.map(serializeSummary)
}

export async function getPricingQuoteDraft(
  id: string,
  organizationId: string
): Promise<PricingQuoteDraftDetail> {
  const draft = await prisma.pricingQuoteDraft.findFirst({ where: { id, organizationId } })
  if (!draft) throw notFound()
  return serializeDetail(draft)
}

export async function createPricingQuoteDraft(
  input: CreatePricingQuoteDraftInput,
  organizationId: string
): Promise<PricingQuoteDraftDetail> {
  const snapshot = normalizePricingInput(input.pricingInput)
  const totals = deriveTotals(snapshot)

  try {
    const draft = await prisma.pricingQuoteDraft.create({
      data: {
        organizationId,
        name: input.name.trim(),
        inputSnapshot: snapshot as unknown as Prisma.InputJsonValue,
        ...totals,
      },
    })
    return serializeDetail(draft)
  } catch (error) {
    throw mapDuplicateName(error)
  }
}

export async function updatePricingQuoteDraft(
  id: string,
  input: UpdatePricingQuoteDraftInput,
  organizationId: string
): Promise<PricingQuoteDraftDetail> {
  const data: Prisma.PricingQuoteDraftUpdateManyMutationInput = {}
  const expectedUpdatedAt = new Date(input.expectedUpdatedAt)
  data.updatedAt = new Date(Math.max(Date.now(), expectedUpdatedAt.getTime() + 1))
  if (input.name !== undefined) data.name = input.name.trim()
  if (input.pricingInput !== undefined) {
    const snapshot = normalizePricingInput(input.pricingInput)
    data.inputSnapshot = snapshot as unknown as Prisma.InputJsonValue
    Object.assign(data, deriveTotals(snapshot))
  }

  try {
    const updated = await prisma.pricingQuoteDraft.updateManyAndReturn({
      where: {
        id,
        organizationId,
        updatedAt: expectedUpdatedAt,
      },
      data,
    })
    if (updated.length === 1) return serializeDetail(updated[0])

    const exists = await prisma.pricingQuoteDraft.findFirst({
      where: { id, organizationId },
      select: { id: true },
    })
    if (!exists) throw notFound()
    throw conflict()
  } catch (error) {
    throw mapDuplicateName(error)
  }
}

export async function deletePricingQuoteDraft(
  id: string,
  organizationId: string,
  expectedUpdatedAt?: string
): Promise<{ id: string; deleted: true }> {
  const result = await prisma.pricingQuoteDraft.deleteMany({
    where: {
      id,
      organizationId,
      ...(expectedUpdatedAt ? { updatedAt: new Date(expectedUpdatedAt) } : {}),
    },
  })
  if (result.count !== 1) {
    if (expectedUpdatedAt) {
      const exists = await prisma.pricingQuoteDraft.findFirst({
        where: { id, organizationId },
        select: { id: true },
      })
      if (exists) throw conflict()
    }
    throw notFound()
  }
  return { id, deleted: true }
}

export async function consumePricingQuoteDraft(
  id: string,
  organizationId: string,
  expectedUpdatedAt: string
): Promise<PricingQuoteDraftConsumeStatus> {
  const result = await prisma.pricingQuoteDraft.deleteMany({
    where: { id, organizationId, updatedAt: new Date(expectedUpdatedAt) },
  })
  if (result.count === 1) return 'consumed'

  const exists = await prisma.pricingQuoteDraft.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  return exists ? 'version_conflict' : 'already_absent'
}

function normalizePricingInput(input: PricingQuoteDraftInput): PricingQuoteDraftInput {
  return materializePricingSetupRates(input as PricingCalculatorInput)
}

function deriveTotals(input: PricingQuoteDraftInput) {
  const result = calculatePricing(input as PricingCalculatorInput)
  const totals = {
    monthlyTotalCents: Math.round(result.monthlyTotal * 100),
    setupTotalCents: Math.round(result.setupTotal * 100),
  }
  if (
    Object.values(totals).some(
      (total) => !Number.isInteger(total) || total < 0 || total > 2_147_483_647
    )
  ) {
    throw new PricingQuoteDraftError(
      'PRICING_QUOTE_DRAFT_TOTAL_INVALID',
      'Pricing quote draft totals exceed supported limits',
      400
    )
  }
  return totals
}

function serializeSummary(draft: PricingQuoteDraft): PricingQuoteDraftSummary {
  return {
    id: draft.id,
    name: draft.name,
    monthlyTotalCents: draft.monthlyTotalCents,
    setupTotalCents: draft.setupTotalCents,
    createdAt: draft.createdAt.toISOString(),
    updatedAt: draft.updatedAt.toISOString(),
  }
}

function serializeDetail(draft: PricingQuoteDraft): PricingQuoteDraftDetail {
  return {
    ...serializeSummary(draft),
    pricingInput: pricingQuoteDraftInputSchema.parse(draft.inputSnapshot),
  }
}

function mapDuplicateName(error: unknown): unknown {
  if (isPrismaError(error, 'P2002')) {
    return new PricingQuoteDraftError(
      'PRICING_QUOTE_DRAFT_DUPLICATE',
      'A pricing quote draft with this name already exists',
      409
    )
  }
  return error
}

function isPrismaError(error: unknown, code: string): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === code)
}

function notFound(): PricingQuoteDraftError {
  return new PricingQuoteDraftError(
    'PRICING_QUOTE_DRAFT_NOT_FOUND',
    'Pricing quote draft not found',
    404
  )
}

function conflict(): PricingQuoteDraftError {
  return new PricingQuoteDraftError(
    'PRICING_QUOTE_DRAFT_CONFLICT',
    'Pricing quote draft was updated by another session',
    409
  )
}
