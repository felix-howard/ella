import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculatePricing,
  createDefaultPricingInput,
  materializePricingSetupRates,
} from '@ella/shared/pricing'

const prismaMocks = vi.hoisted(() => ({
  pricingQuoteDraft: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    updateManyAndReturn: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

import {
  consumePricingQuoteDraft,
  createPricingQuoteDraft,
  deletePricingQuoteDraft,
  getPricingQuoteDraft,
  listPricingQuoteDrafts,
  updatePricingQuoteDraft,
} from '../pricing-quote-draft-service'

const createdAt = new Date('2026-09-08T10:00:00.000Z')
const updatedAt = new Date('2026-09-08T11:00:00.000Z')

function buildPricingInput() {
  return {
    ...createDefaultPricingInput(),
    payrollEmployees: 2,
    customItems: [
      {
        id: 'incomplete_1',
        label: '',
        amount: 0,
        quantity: 0,
        billingInterval: 'one_time' as const,
      },
    ],
  }
}

function buildRow(overrides: Record<string, unknown> = {}) {
  const inputSnapshot = materializePricingSetupRates(buildPricingInput())
  const totals = calculatePricing(inputSnapshot)
  return {
    id: 'draft_1',
    organizationId: 'org_1',
    name: 'September quote',
    inputSnapshot,
    monthlyTotalCents: Math.round(totals.monthlyTotal * 100),
    setupTotalCents: Math.round(totals.setupTotal * 100),
    createdAt,
    updatedAt,
    ...overrides,
  }
}

describe('pricing-quote-draft-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lists only organization drafts in stable summary order', async () => {
    prismaMocks.pricingQuoteDraft.findMany.mockResolvedValue([buildRow()])

    const result = await listPricingQuoteDrafts('org_1')

    expect(prismaMocks.pricingQuoteDraft.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org_1' },
      orderBy: [{ updatedAt: 'desc' }, { name: 'asc' }],
    })
    expect(result).toEqual([
      {
        id: 'draft_1',
        name: 'September quote',
        monthlyTotalCents: buildRow().monthlyTotalCents,
        setupTotalCents: buildRow().setupTotalCents,
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
      },
    ])
  })

  it('fetches full draft detail inside the organization scope', async () => {
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue(buildRow())

    const result = await getPricingQuoteDraft('draft_1', 'org_1')

    expect(prismaMocks.pricingQuoteDraft.findFirst).toHaveBeenCalledWith({
      where: { id: 'draft_1', organizationId: 'org_1' },
    })
    expect(result.pricingInput).toEqual(buildRow().inputSnapshot)
  })

  it('returns the uniform not-found error for missing or cross-org detail', async () => {
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue(null)

    await expect(getPricingQuoteDraft('draft_1', 'org_2')).rejects.toMatchObject({
      code: 'PRICING_QUOTE_DRAFT_NOT_FOUND',
      status: 404,
    })
  })

  it('creates a canonical snapshot with server-derived totals', async () => {
    prismaMocks.pricingQuoteDraft.create.mockImplementation(async ({ data }) =>
      buildRow({ ...data })
    )
    const pricingInput = buildPricingInput()

    await createPricingQuoteDraft({ name: ' September quote ', pricingInput }, 'org_1')

    const canonicalInput = materializePricingSetupRates(pricingInput)
    const result = calculatePricing(canonicalInput)
    expect(prismaMocks.pricingQuoteDraft.create).toHaveBeenCalledWith({
      data: {
        organizationId: 'org_1',
        name: 'September quote',
        inputSnapshot: canonicalInput,
        monthlyTotalCents: Math.round(result.monthlyTotal * 100),
        setupTotalCents: Math.round(result.setupTotal * 100),
      },
    })
  })

  it('maps unique-name races to a stable duplicate error', async () => {
    prismaMocks.pricingQuoteDraft.create.mockRejectedValue({ code: 'P2002' })

    await expect(
      createPricingQuoteDraft(
        { name: 'September quote', pricingInput: buildPricingInput() },
        'org_1'
      )
    ).rejects.toMatchObject({ code: 'PRICING_QUOTE_DRAFT_DUPLICATE', status: 409 })
  })

  it('rejects totals that cannot be stored in PostgreSQL integer columns', async () => {
    const pricingInput = {
      ...buildPricingInput(),
      customItems: [
        {
          id: 'large_1',
          label: 'Large item',
          amount: 999_999,
          quantity: 99,
          billingInterval: 'month' as const,
        },
      ],
    }

    await expect(
      createPricingQuoteDraft({ name: 'Too large', pricingInput }, 'org_1')
    ).rejects.toMatchObject({ code: 'PRICING_QUOTE_DRAFT_TOTAL_INVALID', status: 400 })
    expect(prismaMocks.pricingQuoteDraft.create).not.toHaveBeenCalled()
  })

  it('updates by exact organization and version while recomputing totals', async () => {
    prismaMocks.pricingQuoteDraft.updateManyAndReturn.mockResolvedValue([
      buildRow({ name: 'Renamed' }),
    ])
    const pricingInput = { ...buildPricingInput(), payrollEmployees: 3 }

    await updatePricingQuoteDraft(
      'draft_1',
      {
        name: ' Renamed ',
        pricingInput,
        expectedUpdatedAt: updatedAt.toISOString(),
      },
      'org_1'
    )

    const canonicalInput = materializePricingSetupRates(pricingInput)
    const result = calculatePricing(canonicalInput)
    expect(prismaMocks.pricingQuoteDraft.updateManyAndReturn).toHaveBeenCalledWith({
      where: { id: 'draft_1', organizationId: 'org_1', updatedAt },
      data: {
        updatedAt: expect.any(Date),
        name: 'Renamed',
        inputSnapshot: canonicalInput,
        monthlyTotalCents: Math.round(result.monthlyTotal * 100),
        setupTotalCents: Math.round(result.setupTotal * 100),
      },
    })
    const updateData = prismaMocks.pricingQuoteDraft.updateManyAndReturn.mock.calls[0][0].data
    expect(updateData.updatedAt.getTime()).toBeGreaterThan(updatedAt.getTime())
  })

  it('reports a stale same-org update as conflict without retrying the write', async () => {
    prismaMocks.pricingQuoteDraft.updateManyAndReturn.mockResolvedValue([])
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue({ id: 'draft_1' })

    await expect(
      updatePricingQuoteDraft(
        'draft_1',
        { name: 'Renamed', expectedUpdatedAt: updatedAt.toISOString() },
        'org_1'
      )
    ).rejects.toMatchObject({ code: 'PRICING_QUOTE_DRAFT_CONFLICT', status: 409 })
    expect(prismaMocks.pricingQuoteDraft.updateManyAndReturn).toHaveBeenCalledTimes(1)
  })

  it('keeps cross-org update misses indistinguishable from missing drafts', async () => {
    prismaMocks.pricingQuoteDraft.updateManyAndReturn.mockResolvedValue([])
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue(null)

    await expect(
      updatePricingQuoteDraft(
        'draft_1',
        { name: 'Renamed', expectedUpdatedAt: updatedAt.toISOString() },
        'org_2'
      )
    ).rejects.toMatchObject({ code: 'PRICING_QUOTE_DRAFT_NOT_FOUND', status: 404 })
  })

  it('deletes only by id and organization', async () => {
    prismaMocks.pricingQuoteDraft.deleteMany.mockResolvedValue({ count: 1 })

    await expect(deletePricingQuoteDraft('draft_1', 'org_1')).resolves.toEqual({
      id: 'draft_1',
      deleted: true,
    })
    expect(prismaMocks.pricingQuoteDraft.deleteMany).toHaveBeenCalledWith({
      where: { id: 'draft_1', organizationId: 'org_1' },
    })
  })

  it('returns not found when an org-scoped delete touches no row', async () => {
    prismaMocks.pricingQuoteDraft.deleteMany.mockResolvedValue({ count: 0 })

    await expect(deletePricingQuoteDraft('draft_1', 'org_2')).rejects.toMatchObject({
      code: 'PRICING_QUOTE_DRAFT_NOT_FOUND',
      status: 404,
    })
  })

  it('does not let cleanup retry delete a newer draft version', async () => {
    prismaMocks.pricingQuoteDraft.deleteMany.mockResolvedValue({ count: 0 })
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue({ id: 'draft_1' })
    const expectedUpdatedAt = '2026-09-08T10:00:00.000Z'

    await expect(
      deletePricingQuoteDraft('draft_1', 'org_1', expectedUpdatedAt)
    ).rejects.toMatchObject({
      code: 'PRICING_QUOTE_DRAFT_CONFLICT',
      status: 409,
    })
    expect(prismaMocks.pricingQuoteDraft.deleteMany).toHaveBeenCalledWith({
      where: {
        id: 'draft_1',
        organizationId: 'org_1',
        updatedAt: new Date(expectedUpdatedAt),
      },
    })
  })

  it('consumes only the expected same-organization draft version', async () => {
    prismaMocks.pricingQuoteDraft.deleteMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValueOnce(null)

    const expectedUpdatedAt = '2026-09-08T10:00:00.000Z'
    await expect(
      consumePricingQuoteDraft('draft_1', 'org_1', expectedUpdatedAt)
    ).resolves.toBe('consumed')
    await expect(
      consumePricingQuoteDraft('draft_1', 'org_1', expectedUpdatedAt)
    ).resolves.toBe('already_absent')
    expect(prismaMocks.pricingQuoteDraft.deleteMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: 'draft_1',
        organizationId: 'org_1',
        updatedAt: new Date(expectedUpdatedAt),
      },
    })
  })

  it('preserves a newer same-organization draft version during final consumption', async () => {
    prismaMocks.pricingQuoteDraft.deleteMany.mockResolvedValue({ count: 0 })
    prismaMocks.pricingQuoteDraft.findFirst.mockResolvedValue({ id: 'draft_1' })

    await expect(
      consumePricingQuoteDraft('draft_1', 'org_1', '2026-09-08T10:00:00.000Z')
    ).resolves.toBe('version_conflict')
  })
})
