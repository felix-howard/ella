import type { CheckoutPricingInput, CreateCheckoutSessionInput } from '../../../routes/billing/schemas'

export const basePricingInput: CheckoutPricingInput = {
  nec1099Count: 11,
  payrollEmployees: 0,
  payrollMode: 'owner-manual',
  cashPlan: { enabled: false, employees: 0, owners: 0 },
  auditProtection: false,
  oneTime: {
    startLlc: 0,
    holdingLlcNew: 0,
    holdingLlcModify: 0,
    personalTaxReturn: 0,
    businessTaxReturn: 0,
  },
  salesTaxShops: 0,
  rates: {
    tiers: { basicMonthly: 75, proMonthly: 85, vipMonthly: 85 },
    payroll: { baseMonthly: 50 },
    cashPlan: { setup: 1000, perEmployeeMonthly: 5, perOwnerMonthly: 50 },
    auditProtection: { monthly: 300, setup: 1000 },
    oneTime: {
      startLlc: 1500,
      holdingLlcNew: 4000,
      holdingLlcModify: 1000,
      personalTaxReturn: 150,
      businessTaxReturnFederal: 600,
      businessTaxReturnState: 100,
    },
    salesTaxMonitoringMonthly: 25,
  },
}

export function checkoutRequest(): CreateCheckoutSessionInput {
  return {
    pricingInput: basePricingInput,
    customerEmail: 'client@example.com',
    customerName: 'Test Client',
    businessName: 'Test Business',
    quoteNotes: 'Internal support note',
  }
}
