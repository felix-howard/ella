import { z } from 'zod'
import {
  MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT,
  MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY,
  MAX_CALCULATOR_CUSTOM_ITEMS,
  MAX_CALCULATOR_CUSTOM_LABEL_LENGTH,
} from '@ella/shared/pricing'

const quantitySchema = z.number().int().min(0).max(1000)
const rateSchema = z.number().int().min(0).max(1_000_000)
const calculatorCustomItemSchema = z.object({
  id: z.string().trim().min(1).max(120),
  label: z.string().trim().min(1).max(MAX_CALCULATOR_CUSTOM_LABEL_LENGTH),
  amount: z.number().int().min(1).max(MAX_CALCULATOR_CUSTOM_ITEM_AMOUNT),
  quantity: z.number().int().min(1).max(MAX_CALCULATOR_CUSTOM_ITEM_QUANTITY),
  billingInterval: z.enum(['one_time', 'month']),
})

export const checkoutPricingInputSchema = z.object({
  nec1099Count: quantitySchema,
  payrollEmployees: quantitySchema,
  payrollMode: z.enum(['owner-manual', 'ella-staff']),
  cashPlan: z.object({
    enabled: z.boolean(),
    employees: quantitySchema,
    owners: quantitySchema,
  }),
  auditProtection: z.boolean(),
  oneTime: z.object({
    startLlc: quantitySchema,
    holdingLlcNew: quantitySchema,
    holdingLlcModify: quantitySchema,
    personalTaxReturn: quantitySchema,
    businessTaxReturn: quantitySchema,
  }),
  salesTaxShops: quantitySchema,
  customItems: z.array(calculatorCustomItemSchema).max(MAX_CALCULATOR_CUSTOM_ITEMS).default([]),
  rates: z.object({
    tiers: z.object({
      basicMonthly: rateSchema,
      proMonthly: rateSchema,
      vipMonthly: rateSchema,
    }),
    payroll: z.object({
      baseMonthly: rateSchema,
    }),
    cashPlan: z.object({
      setup: rateSchema,
      perEmployeeMonthly: rateSchema,
      perOwnerMonthly: rateSchema,
    }),
    auditProtection: z.object({
      monthly: rateSchema,
      setup: rateSchema,
    }),
    oneTime: z.object({
      startLlc: rateSchema,
      holdingLlcNew: rateSchema,
      holdingLlcModify: rateSchema,
      personalTaxReturn: rateSchema,
      businessTaxReturnFederal: rateSchema,
      businessTaxReturnState: rateSchema,
    }),
    salesTaxMonitoringMonthly: rateSchema,
  }),
})

export const createCheckoutSessionSchema = z.object({
  pricingInput: checkoutPricingInputSchema,
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  quoteNotes: z.string().trim().max(1000).optional(),
})

const recipientSchema = z.object({
  type: z.enum(['client', 'lead']),
  id: z.string().trim().min(1),
})

export const sendQuoteInputSchema = z.object({
  pricingInput: checkoutPricingInputSchema,
  recipient: recipientSchema,
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
})

// --- Custom (free-form) payment links --------------------------------------
// Staff type arbitrary line items instead of driving the pricing calculator.
// Limits mirror the server-side `buildCustomQuote` validation so a request is
// rejected at the edge before any Stripe/DB work.

const MAX_CUSTOM_UNIT_AMOUNT_CENTS = 1_000_000_00
export const MAX_CUSTOM_ITEMS = 50

export const customLineItemSchema = z.object({
  label: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  unitAmountCents: z.number().int().min(1).max(MAX_CUSTOM_UNIT_AMOUNT_CENTS),
  quantity: z.number().int().min(1).max(1000),
})

export const customBillingIntervalEnum = z.enum(['one_time', 'month', 'year'])

/** Fields shared by the anonymous-create and send-to-recipient custom flows. */
const customQuoteFields = {
  billingInterval: customBillingIntervalEnum,
  items: z.array(customLineItemSchema).min(1).max(MAX_CUSTOM_ITEMS),
  /** One-time add-on items; only valid for recurring links. */
  oneTimeItems: z.array(customLineItemSchema).max(MAX_CUSTOM_ITEMS).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
  /** Owner-attached coupon (app `Coupon.id`). XOR with `allowPromotionCodes`. */
  couponId: z.string().cuid().optional(),
  /** Let the client type a promo code at Stripe checkout. XOR with `couponId`. */
  allowPromotionCodes: z.boolean().optional(),
}

const notBothDiscounts = (v: { couponId?: string; allowPromotionCodes?: boolean }): boolean =>
  !(v.couponId && v.allowPromotionCodes)

const oneTimeItemsOnlyRecurring = (v: {
  billingInterval: 'one_time' | 'month' | 'year'
  oneTimeItems?: unknown[]
}): boolean => v.billingInterval !== 'one_time' || !v.oneTimeItems?.length

const NOT_BOTH_DISCOUNTS_ERROR = {
  message: 'Cannot pre-apply a coupon and allow promotion codes on the same link',
  path: ['allowPromotionCodes'],
}
const ONE_TIME_ITEMS_ERROR = {
  message: 'oneTimeItems are only allowed on recurring (month/year) links',
  path: ['oneTimeItems'],
}

export const createCustomCheckoutSchema = z
  .object(customQuoteFields)
  .refine(notBothDiscounts, NOT_BOTH_DISCOUNTS_ERROR)
  .refine(oneTimeItemsOnlyRecurring, ONE_TIME_ITEMS_ERROR)

export const sendCustomQuoteSchema = z
  .object({ ...customQuoteFields, recipient: recipientSchema })
  .refine(notBothDiscounts, NOT_BOTH_DISCOUNTS_ERROR)
  .refine(oneTimeItemsOnlyRecurring, ONE_TIME_ITEMS_ERROR)

export const paymentTemplateItemsSchema = z
  .object({
    billingInterval: customBillingIntervalEnum,
    items: z.array(customLineItemSchema).min(1).max(MAX_CUSTOM_ITEMS),
    oneTimeItems: z.array(customLineItemSchema).max(MAX_CUSTOM_ITEMS).optional(),
  })
  .refine(oneTimeItemsOnlyRecurring, ONE_TIME_ITEMS_ERROR)

export const createPaymentTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  template: paymentTemplateItemsSchema,
})

export const updatePaymentTemplateSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    description: z.string().trim().max(500).nullable().optional(),
    template: paymentTemplateItemsSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  })

export const paymentTemplateIdParamSchema = z.object({
  id: z.string().trim().min(1),
})

export type CheckoutPricingInput = z.infer<typeof checkoutPricingInputSchema>
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>
export type SendQuoteInput = z.infer<typeof sendQuoteInputSchema>
export type CustomLineItemSchema = z.infer<typeof customLineItemSchema>
export type CreateCustomCheckoutInput = z.infer<typeof createCustomCheckoutSchema>
export type SendCustomQuoteInput = z.infer<typeof sendCustomQuoteSchema>
export type PaymentTemplateItemsInput = z.infer<typeof paymentTemplateItemsSchema>
export type CreatePaymentTemplateInput = z.infer<typeof createPaymentTemplateSchema>
export type UpdatePaymentTemplateInput = z.infer<typeof updatePaymentTemplateSchema>
