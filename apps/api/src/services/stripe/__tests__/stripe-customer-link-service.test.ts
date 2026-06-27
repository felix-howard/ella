import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripeMocks = vi.hoisted(() => ({
  customersCreate: vi.fn(),
}))

const prismaMocks = vi.hoisted(() => ({
  client: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
}))

vi.mock('../../../lib/db', () => ({ prisma: prismaMocks }))

vi.mock('../client', () => ({
  getStripeClient: () => ({
    customers: { create: stripeMocks.customersCreate },
  }),
}))

import {
  buildCheckoutCustomerOptionsForClient,
  ensureStripeCustomerForClient,
  linkClientToStripeCustomerIfMissing,
} from '../stripe-customer-link-service'

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'client_1',
    firstName: 'Anna',
    lastName: 'Nguyen',
    name: 'Anna Nguyen',
    email: 'anna@example.com',
    phone: '+14155551234',
    stripeCustomerId: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  stripeMocks.customersCreate.mockResolvedValue({ id: 'cus_new' })
  prismaMocks.client.updateMany.mockResolvedValue({ count: 1 })
})

describe('ensureStripeCustomerForClient', () => {
  it('reuses an existing Stripe Customer id', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(clientRow({ stripeCustomerId: 'cus_existing' }))

    await expect(
      ensureStripeCustomerForClient({ clientId: 'client_1', organizationId: 'org_1' })
    ).resolves.toBe('cus_existing')

    expect(stripeMocks.customersCreate).not.toHaveBeenCalled()
    expect(prismaMocks.client.updateMany).not.toHaveBeenCalled()
  })

  it('creates a Stripe Customer and stores it on the org-scoped client', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(clientRow())

    await expect(
      ensureStripeCustomerForClient({ clientId: 'client_1', organizationId: 'org_1' })
    ).resolves.toBe('cus_new')

    expect(stripeMocks.customersCreate).toHaveBeenCalledWith(
      {
        email: 'anna@example.com',
        name: 'Anna Nguyen',
        phone: '+14155551234',
        metadata: {
          ellaClientId: 'client_1',
          ellaOrganizationId: 'org_1',
          source: 'ella',
        },
      },
      { idempotencyKey: 'ella-client-client_1-customer-v1' }
    )
    expect(prismaMocks.client.updateMany).toHaveBeenCalledWith({
      where: { id: 'client_1', organizationId: 'org_1', stripeCustomerId: null },
      data: {
        stripeCustomerId: 'cus_new',
        stripeCustomerLinkedAt: expect.any(Date),
      },
    })
  })

  it('omits unsafe phone values when creating the Stripe Customer', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(clientRow({ phone: '(415) 555-1234' }))

    await ensureStripeCustomerForClient({ clientId: 'client_1', organizationId: 'org_1' })

    expect(stripeMocks.customersCreate.mock.calls[0]?.[0]).not.toHaveProperty('phone')
  })

  it('re-reads the client when another request links the customer first', async () => {
    prismaMocks.client.findFirst
      .mockResolvedValueOnce(clientRow())
      .mockResolvedValueOnce({ stripeCustomerId: 'cus_race' })
    prismaMocks.client.updateMany.mockResolvedValue({ count: 0 })

    await expect(
      ensureStripeCustomerForClient({ clientId: 'client_1', organizationId: 'org_1' })
    ).resolves.toBe('cus_race')
  })

  it('re-reads the client after a direct unique-constraint race', async () => {
    prismaMocks.client.findFirst
      .mockResolvedValueOnce(clientRow())
      .mockResolvedValueOnce({ stripeCustomerId: 'cus_p2002' })
    prismaMocks.client.updateMany.mockRejectedValue(Object.assign(new Error('Unique'), { code: 'P2002' }))

    await expect(
      ensureStripeCustomerForClient({ clientId: 'client_1', organizationId: 'org_1' })
    ).resolves.toBe('cus_p2002')
  })

  it('returns checkout customer params for callers that need Stripe Checkout options', async () => {
    prismaMocks.client.findFirst.mockResolvedValue(clientRow({ stripeCustomerId: 'cus_existing' }))

    await expect(
      buildCheckoutCustomerOptionsForClient({ clientId: 'client_1', organizationId: 'org_1' })
    ).resolves.toEqual({ customer: 'cus_existing' })
  })
})

describe('linkClientToStripeCustomerIfMissing', () => {
  it('links an unlinked org-scoped client', async () => {
    await expect(
      linkClientToStripeCustomerIfMissing({
        clientId: 'client_1',
        organizationId: 'org_1',
        stripeCustomerId: 'cus_session',
      })
    ).resolves.toBe('cus_session')

    expect(prismaMocks.client.updateMany).toHaveBeenCalledWith({
      where: { id: 'client_1', organizationId: 'org_1', stripeCustomerId: null },
      data: {
        stripeCustomerId: 'cus_session',
        stripeCustomerLinkedAt: expect.any(Date),
      },
    })
  })

  it('returns the existing customer id without overwriting it', async () => {
    prismaMocks.client.updateMany.mockResolvedValue({ count: 0 })
    prismaMocks.client.findFirst.mockResolvedValue({ stripeCustomerId: 'cus_existing' })

    await expect(
      linkClientToStripeCustomerIfMissing({
        clientId: 'client_1',
        organizationId: 'org_1',
        stripeCustomerId: 'cus_session',
      })
    ).resolves.toBe('cus_existing')
  })

  it('does not persist malformed customer ids', async () => {
    await expect(
      linkClientToStripeCustomerIfMissing({
        clientId: 'client_1',
        organizationId: 'org_1',
        stripeCustomerId: 'not_a_customer',
      })
    ).resolves.toBeNull()

    expect(prismaMocks.client.updateMany).not.toHaveBeenCalled()
  })

  it('re-reads the client after a unique conflict while linking from a session', async () => {
    prismaMocks.client.updateMany.mockRejectedValue(Object.assign(new Error('Unique'), { code: 'P2002' }))
    prismaMocks.client.findFirst.mockResolvedValue({ stripeCustomerId: 'cus_existing' })

    await expect(
      linkClientToStripeCustomerIfMissing({
        clientId: 'client_1',
        organizationId: 'org_1',
        stripeCustomerId: 'cus_session',
      })
    ).resolves.toBe('cus_existing')
  })
})
