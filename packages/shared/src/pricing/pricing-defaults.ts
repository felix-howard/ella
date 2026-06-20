import {
  AUDIT_PROTECTION,
  CASH_PLAN,
  ONE_TIME,
  PAYROLL,
  SALES_TAX_MONITORING_MONTHLY,
  TIER_BASIC,
  TIER_PRO,
} from '../constants'
import type { PricingCalculatorInput } from './calculator'

export const ONE_TIME_LABELS: Record<keyof PricingCalculatorInput['oneTime'], string> = {
  startLlc: 'Start LLC',
  holdingLlcNew: 'Holding LLC (new)',
  holdingLlcModify: 'Re-structure LLC basic',
  personalTaxReturn: 'Personal tax return',
  businessTaxReturn: 'Business tax return pre-pay (1 tax year)',
}

export function createDefaultPricingInput(): PricingCalculatorInput {
  return {
    nec1099Count: 0,
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
      tiers: {
        basicMonthly: TIER_BASIC.monthly,
        proMonthly: TIER_PRO.monthly,
        vipMonthly: TIER_PRO.monthly,
      },
      payroll: {
        baseMonthly: PAYROLL.baseMonthly,
      },
      cashPlan: {
        setup: CASH_PLAN.setup,
        perEmployeeMonthly: CASH_PLAN.perEmployeeMonthly,
        perOwnerMonthly: CASH_PLAN.perOwnerMonthly,
      },
      auditProtection: {
        monthly: AUDIT_PROTECTION.monthly,
        setup: AUDIT_PROTECTION.setup,
      },
      oneTime: {
        startLlc: ONE_TIME.startLlc,
        holdingLlcNew: ONE_TIME.holdingLlcNew,
        holdingLlcModify: ONE_TIME.holdingLlcModify,
        personalTaxReturn: ONE_TIME.personalTaxReturn,
        businessTaxReturnFederal: ONE_TIME.businessTaxReturnFederal,
        businessTaxReturnState: ONE_TIME.businessTaxReturnState,
      },
      salesTaxMonitoringMonthly: SALES_TAX_MONITORING_MONTHLY,
    },
  }
}
