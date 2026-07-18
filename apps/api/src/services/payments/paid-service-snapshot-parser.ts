import { z } from 'zod'

export type PaidServiceCategory = 'RECURRING' | 'ONE_TIME'
export type PaidServiceCadence = 'MONTH' | 'YEAR' | 'ONE_TIME'

export interface NormalizedPaidServiceItem {
  id: string
  label: string
  description: string | null
  category: PaidServiceCategory
  cadence: PaidServiceCadence
}

const MAX_SNAPSHOT_ITEMS = 100
const MAX_CALCULATOR_AMOUNT = 999_999
const MAX_CUSTOM_UNIT_AMOUNT_CENTS = 100_000_000

const labelSchema = z.string().trim().min(1).max(120)
const descriptionSchema = z.string().trim().max(500).optional()
const calculatorLineBase = {
  label: labelSchema,
  description: descriptionSchema,
  amount: z.number().finite().positive().max(MAX_CALCULATOR_AMOUNT),
}

const calculatorSnapshotSchema = z
  .object({
    quoteId: z.string().trim().min(1).max(120),
    monthlyItems: z.array(z.object({ ...calculatorLineBase, kind: z.literal('monthly') })),
    setupItems: z.array(z.object({ ...calculatorLineBase, kind: z.literal('setup') })),
  })
  .superRefine((snapshot, context) => {
    const itemCount = snapshot.monthlyItems.length + snapshot.setupItems.length
    if (itemCount < 1 || itemCount > MAX_SNAPSHOT_ITEMS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Snapshot must contain 1-${MAX_SNAPSHOT_ITEMS} items`,
      })
    }
  })

const customSnapshotSchema = z.object({
  quoteId: z.string().trim().min(1).max(120),
  lineItems: z
    .array(
      z.object({
        label: labelSchema,
        description: descriptionSchema,
        unitAmountCents: z.number().int().min(1).max(MAX_CUSTOM_UNIT_AMOUNT_CENTS),
        quantity: z.number().int().min(1).max(1_000),
        interval: z.enum(['one_time', 'month', 'year']),
      }),
    )
    .min(1)
    .max(MAX_SNAPSHOT_ITEMS),
})

export function parsePaidServiceSnapshot(input: {
  quoteId: string
  source: string
  billingInterval: string | null
  snapshot: unknown
}): NormalizedPaidServiceItem[] {
  if (input.source === 'calculator') return parseCalculatorSnapshot(input)
  if (input.source === 'custom') return parseCustomSnapshot(input)
  throw new Error('Unsupported paid-service quote source')
}

function parseCalculatorSnapshot(input: {
  quoteId: string
  snapshot: unknown
}): NormalizedPaidServiceItem[] {
  const snapshot = calculatorSnapshotSchema.parse(input.snapshot)
  assertMatchingQuoteId(snapshot.quoteId, input.quoteId)

  return [
    ...snapshot.monthlyItems.map((item, index) => ({
      id: `monthly-${index + 1}`,
      label: item.label,
      description: item.description || null,
      category: 'RECURRING' as const,
      cadence: 'MONTH' as const,
    })),
    ...snapshot.setupItems.map((item, index) => ({
      id: `setup-${index + 1}`,
      label: item.label,
      description: item.description || null,
      category: 'ONE_TIME' as const,
      cadence: 'ONE_TIME' as const,
    })),
  ]
}

function parseCustomSnapshot(input: {
  quoteId: string
  billingInterval: string | null
  snapshot: unknown
}): NormalizedPaidServiceItem[] {
  const snapshot = customSnapshotSchema.parse(input.snapshot)
  assertMatchingQuoteId(snapshot.quoteId, input.quoteId)
  assertCustomIntervals(snapshot.lineItems, input.billingInterval)

  return snapshot.lineItems.map((item, index) => ({
    id: `line-${index + 1}`,
    label: item.label,
    description: item.description || null,
    category: item.interval === 'one_time' ? 'ONE_TIME' : 'RECURRING',
    cadence: cadenceFor(item.interval),
  }))
}

function assertMatchingQuoteId(snapshotQuoteId: string, quoteId: string): void {
  if (snapshotQuoteId !== quoteId) throw new Error('Snapshot quote ID mismatch')
}

function assertCustomIntervals(
  items: Array<{ interval: 'one_time' | 'month' | 'year' }>,
  billingInterval: string | null,
): void {
  const allowed =
    billingInterval === 'month'
      ? new Set(['month', 'one_time'])
      : billingInterval === 'year'
        ? new Set(['year', 'one_time'])
        : billingInterval === null
          ? new Set(['one_time'])
          : null
  if (!allowed || items.some((item) => !allowed.has(item.interval))) {
    throw new Error('Custom snapshot billing interval mismatch')
  }
}

function cadenceFor(interval: 'one_time' | 'month' | 'year'): PaidServiceCadence {
  if (interval === 'month') return 'MONTH'
  if (interval === 'year') return 'YEAR'
  return 'ONE_TIME'
}
