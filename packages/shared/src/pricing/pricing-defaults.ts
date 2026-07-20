import {
  AUDIT_PROTECTION,
  CASH_PLAN,
  ONE_TIME,
  PAYROLL,
  SALES_TAX_MONITORING_MONTHLY,
  TIER_BASIC,
  TIER_PRO,
} from '../constants'
import type { PricingCalculatorInput, Tier } from './calculator'

export const BUSINESS_TAX_RETURN_PREPAY_LABEL = 'Business tax return pre-pay (1 tax year)'

export const ONE_TIME_LABELS: Record<keyof PricingCalculatorInput['oneTime'], string> = {
  startLlc: 'Start LLC',
  holdingLlcNew: 'Holding LLC (new)',
  holdingLlcModify: 'LLC restructure',
  personalTaxReturn: 'Personal tax return',
  businessTaxReturn: BUSINESS_TAX_RETURN_PREPAY_LABEL,
}

export function detectPricingTier(nec1099Count: number): Tier {
  if (nec1099Count <= TIER_BASIC.maxNec1099) return 'basic'
  if (nec1099Count <= TIER_PRO.maxNec1099) return 'pro'
  return 'vip'
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
    customItems: [],
    rates: {
      bookkeeping: {
        setup: TIER_BASIC.setup,
      },
      tiers: {
        basicMonthly: TIER_BASIC.monthly,
        proMonthly: TIER_PRO.monthly,
        vipMonthly: TIER_PRO.monthly,
      },
      payroll: {
        baseMonthly: PAYROLL.baseMonthly,
        setup: PAYROLL.baseSetup,
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

/**
 * Freeze setup defaults into a calculator snapshot. Persisted quotes must not
 * depend on future constants or legacy display-label recovery.
 */
export function materializePricingSetupRates(
  input: PricingCalculatorInput
): PricingCalculatorInput {
  const tier = detectPricingTier(input.nec1099Count)
  const bookkeepingSetup = tier === 'basic' ? TIER_BASIC.setup : TIER_PRO.setup
  return {
    ...input,
    rates: {
      ...input.rates,
      bookkeeping: input.rates.bookkeeping ?? { setup: bookkeepingSetup },
      payroll: {
        ...input.rates.payroll,
        setup: input.rates.payroll.setup ?? PAYROLL.baseSetup,
      },
    },
  }
}
