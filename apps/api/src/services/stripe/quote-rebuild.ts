/**
 * Source-aware rebuild of the line items a checkout session should charge.
 *
 * Calculator quotes are drift-safe by recomputation: the frozen `pricingInput`
 * is re-run through `calculateCheckoutQuote` (rate-validated, deterministic).
 * Legacy inputs missing setup overrides recover those values from their frozen
 * result so later default-price changes cannot alter an existing payment link.
 * Custom quotes have no `pricingInput` — their normalized `lineItems` were frozen
 * into `resultSnapshot` at create/send time and ARE the source of truth, so we
 * read them straight back (no recompute) after re-validating their shape.
 */
import { z } from 'zod'
import { MAX_CHECKOUT_LINE_AMOUNT } from '@ella/shared/pricing'
import { calculateCheckoutQuote } from './quote-calculator'
import { toCheckoutLineItems, type CheckoutLineItem } from './checkout-line-items'
import {
  checkoutPricingInputSchema,
  type CheckoutPricingInput,
} from '../../routes/billing/schemas'
import { getActiveCouponById } from '../coupons/coupon-service'

/** Minimal PaymentQuote shape the rebuild needs (decoupled from the Prisma model). */
export interface RebuildableQuote {
  source: string
  inputSnapshot: unknown
  resultSnapshot: unknown
  monthlyTotalCents: number
  setupTotalCents: number
  appliedCouponId: string | null
  allowPromotionCodes: boolean
  organizationId: string | null
}

const storedLineItemSchema = z.object({
  label: z.string().min(1),
  description: z.string().optional(),
  unitAmountCents: z.number().int().positive(),
  quantity: z.number().int().positive(),
  interval: z.enum(['one_time', 'month', 'year']),
})
const storedLineItemsSchema = z.array(storedLineItemSchema).min(1)
const storedCalculatorResultSchema = z.object({
  setupItems: z.array(
    z.object({
      label: z.string().min(1),
      amount: z.number().finite().min(0).max(MAX_CHECKOUT_LINE_AMOUNT),
      kind: z.literal('setup'),
    })
  ),
})
const LEGACY_SETUP_LABELS = {
  bookkeeping: 'Bookkeeping onboarding setup',
  payroll: 'Payroll setup',
} as const

export function rebuildQuoteForCheckout(quote: RebuildableQuote): CheckoutLineItem[] {
  let lineItems: CheckoutLineItem[]
  if (quote.source === 'custom') {
    const snapshot = quote.resultSnapshot
    const raw =
      snapshot && typeof snapshot === 'object'
        ? (snapshot as { lineItems?: unknown }).lineItems
        : undefined
    lineItems = storedLineItemsSchema.parse(raw)
  } else {
    const pricingInput = parsePricingInput(quote.inputSnapshot, quote.resultSnapshot)
    lineItems = toCheckoutLineItems(calculateCheckoutQuote(pricingInput))
  }

  assertLineItemTotalsMatchStoredQuote(lineItems, quote)
  return lineItems
}

function assertLineItemTotalsMatchStoredQuote(
  lineItems: CheckoutLineItem[],
  quote: Pick<RebuildableQuote, 'monthlyTotalCents' | 'setupTotalCents'>
): void {
  if (
    !Number.isSafeInteger(quote.monthlyTotalCents) ||
    quote.monthlyTotalCents < 0 ||
    !Number.isSafeInteger(quote.setupTotalCents) ||
    quote.setupTotalCents < 0
  ) {
    throw new Error('Stored quote totals are invalid')
  }

  const totals = lineItems.reduce(
    (sum, item) => {
      const amount = item.unitAmountCents * item.quantity
      if (item.interval === 'one_time') sum.setup += amount
      else sum.recurring += amount
      return sum
    },
    { recurring: 0, setup: 0 }
  )
  if (
    totals.recurring !== quote.monthlyTotalCents ||
    totals.setup !== quote.setupTotalCents
  ) {
    throw new Error('Rebuilt checkout totals do not match stored quote totals')
  }
}

function parsePricingInput(snapshot: unknown, resultSnapshot: unknown): CheckoutPricingInput {
  const raw =
    snapshot && typeof snapshot === 'object'
      ? (snapshot as { pricingInput?: unknown }).pricingInput
      : undefined
  return hydrateLegacySetupRates(checkoutPricingInputSchema.parse(raw), resultSnapshot)
}

function hydrateLegacySetupRates(
  input: CheckoutPricingInput,
  resultSnapshot: unknown
): CheckoutPricingInput {
  const needsBookkeepingSetup = !input.rates.bookkeeping
  const needsPayrollSetup = input.payrollEmployees > 0 && input.rates.payroll.setup === undefined
  if (!needsBookkeepingSetup && !needsPayrollSetup) return input

  const parsedResult = storedCalculatorResultSchema.safeParse(resultSnapshot)
  if (!parsedResult.success) throw new Error('Stored calculator pricing snapshot is invalid')

  const frozenSetupAmount = (label: string) => {
    const matches = parsedResult.data.setupItems.filter((item) => item.label === label)
    if (matches.length !== 1) {
      throw new Error('Stored calculator setup pricing is missing or ambiguous')
    }
    return matches[0].amount
  }
  const bookkeepingSetup = needsBookkeepingSetup
    ? frozenSetupAmount(LEGACY_SETUP_LABELS.bookkeeping)
    : input.rates.bookkeeping!.setup
  const payrollSetup = needsPayrollSetup
    ? frozenSetupAmount(LEGACY_SETUP_LABELS.payroll)
    : input.rates.payroll.setup

  return {
    ...input,
    rates: {
      ...input.rates,
      bookkeeping: { setup: bookkeepingSetup },
      payroll: {
        ...input.rates.payroll,
        setup: input.rates.payroll.setup ?? payrollSetup,
      },
    },
  }
}

/** Coupon options for a checkout session, honoring the coupon-XOR-promo rule. */
export interface CouponSessionOptions {
  stripeCouponId?: string
  allowPromotionCodes?: boolean
}

/**
 * Resolve the coupon attach options for a stored quote. A pre-applied coupon
 * (active + synced to Stripe) wins; otherwise promo codes are offered if the
 * quote was created with that flag. Never returns both.
 *
 * Fail-open policy: if a pre-applied coupon was since disabled/unsynced,
 * `getActiveCouponById` returns null and we fall through to full price rather
 * than block the client's payment. The create/send flows validate the coupon up
 * front and reject a bad id; this resolver runs later, at portal checkout, where
 * letting the client pay full price beats failing the checkout outright.
 */
export async function resolveQuoteCouponOptions(
  quote: RebuildableQuote
): Promise<CouponSessionOptions> {
  if (quote.appliedCouponId && quote.organizationId) {
    const coupon = await getActiveCouponById(quote.appliedCouponId, quote.organizationId)
    if (coupon?.stripeCouponId) return { stripeCouponId: coupon.stripeCouponId }
  }
  if (quote.allowPromotionCodes) return { allowPromotionCodes: true }
  return {}
}
