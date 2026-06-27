import type Stripe from 'stripe'
import { prisma } from '../../lib/db'
import { getStripeClient } from './client'

interface ClientLookup {
  id: string
  firstName: string
  lastName: string | null
  name: string
  email: string | null
  phone: string
  stripeCustomerId: string | null
}

export interface StripeCustomerForClientInput {
  clientId: string
  organizationId: string
}

export interface LinkClientStripeCustomerInput extends StripeCustomerForClientInput {
  stripeCustomerId: string | null | undefined
}

export type CheckoutCustomerOptions = Pick<Stripe.Checkout.SessionCreateParams, 'customer'>

export async function ensureStripeCustomerForClient(
  input: StripeCustomerForClientInput
): Promise<string> {
  const client = await findClientForStripeLink(input)
  if (!client) throw new Error('Client not found')
  if (client.stripeCustomerId) return client.stripeCustomerId

  const stripeCustomer = await getStripeClient().customers.create(
    buildStripeCustomerParams(client, input.organizationId),
    { idempotencyKey: `ella-client-${input.clientId}-customer-v1` }
  )

  try {
    const updated = await prisma.client.updateMany({
      where: { id: input.clientId, organizationId: input.organizationId, stripeCustomerId: null },
      data: {
        stripeCustomerId: stripeCustomer.id,
        stripeCustomerLinkedAt: new Date(),
      },
    })
    if (updated.count > 0) return stripeCustomer.id
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  const linkedCustomerId = await rereadStripeCustomerId(input)
  if (linkedCustomerId) return linkedCustomerId
  throw new Error('Unable to link Stripe Customer to client')
}

export async function linkClientToStripeCustomerIfMissing(
  input: LinkClientStripeCustomerInput
): Promise<string | null> {
  const stripeCustomerId = normalizeStripeCustomerId(input.stripeCustomerId)
  if (!stripeCustomerId) return null

  try {
    const updated = await prisma.client.updateMany({
      where: { id: input.clientId, organizationId: input.organizationId, stripeCustomerId: null },
      data: {
        stripeCustomerId,
        stripeCustomerLinkedAt: new Date(),
      },
    })
    if (updated.count > 0) return stripeCustomerId
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
  }

  return rereadStripeCustomerId(input)
}

export async function buildCheckoutCustomerOptionsForClient(
  input: StripeCustomerForClientInput
): Promise<CheckoutCustomerOptions> {
  return { customer: await ensureStripeCustomerForClient(input) }
}

async function findClientForStripeLink(
  input: StripeCustomerForClientInput
): Promise<ClientLookup | null> {
  return prisma.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      phone: true,
      stripeCustomerId: true,
    },
  })
}

async function rereadStripeCustomerId(input: StripeCustomerForClientInput): Promise<string | null> {
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, organizationId: input.organizationId },
    select: { stripeCustomerId: true },
  })
  return client?.stripeCustomerId ?? null
}

function buildStripeCustomerParams(
  client: ClientLookup,
  organizationId: string
): Stripe.CustomerCreateParams {
  const name = buildClientName(client)
  const phone = getSafeStripePhone(client.phone)

  return {
    ...(client.email ? { email: client.email } : {}),
    ...(name ? { name } : {}),
    ...(phone ? { phone } : {}),
    metadata: {
      ellaClientId: client.id,
      ellaOrganizationId: organizationId,
      source: 'ella',
    },
  }
}

function buildClientName(client: Pick<ClientLookup, 'firstName' | 'lastName' | 'name'>): string | undefined {
  const fullName = [client.firstName, client.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')
  return fullName || client.name.trim() || undefined
}

function getSafeStripePhone(phone: string | null): string | undefined {
  const trimmed = phone?.trim()
  return trimmed && /^\+[1-9]\d{9,14}$/.test(trimmed) ? trimmed : undefined
}

function normalizeStripeCustomerId(stripeCustomerId: string | null | undefined): string | null {
  const trimmed = stripeCustomerId?.trim()
  return trimmed && /^cus_[A-Za-z0-9]+$/.test(trimmed) ? trimmed : null
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && (error as { code?: string }).code === 'P2002')
}
