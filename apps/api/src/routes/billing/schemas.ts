import { z } from 'zod'

const quantitySchema = z.number().int().min(0).max(1000)
const rateSchema = z.number().int().min(0).max(1_000_000)

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

export const sendQuoteInputSchema = z.object({
  pricingInput: checkoutPricingInputSchema,
  recipient: z.object({
    type: z.enum(['client', 'lead']),
    id: z.string().trim().min(1),
  }),
  customerEmail: z.string().email().optional(),
  customerName: z.string().trim().min(1).max(120).optional(),
  businessName: z.string().trim().min(1).max(120).optional(),
})

export type CheckoutPricingInput = z.infer<typeof checkoutPricingInputSchema>
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>
export type SendQuoteInput = z.infer<typeof sendQuoteInputSchema>
