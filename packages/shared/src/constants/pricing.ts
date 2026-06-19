export const TIER_BASIC = {
  id: 'basic' as const,
  label: 'Basic',
  tagline: 'For small shops starting out',
  monthly: 75,
  setup: 150,
  marketingMonthly: 125,
  maxNec1099: 10,
  bullets: [
    'Bookkeeping + quarterly reviews',
    'Payroll base included',
    'Up to 10 workers (1099-NEC)',
    'Email support',
  ],
}

export const TIER_PRO = {
  id: 'pro' as const,
  label: 'Pro',
  tagline: 'For growing salons',
  monthly: 85,
  setup: 150,
  marketingMonthly: 135,
  maxNec1099: 20,
  bullets: [
    'Everything in Basic',
    '11-20 workers (1099-NEC)',
    'Priority email + SMS support',
    'Monthly accountant check-ins',
  ],
}

export const TIER_ENTERPRISE = {
  id: 'enterprise' as const,
  label: 'Enterprise — Contact Us',
  marketingLabel: 'VIP',
  tagline: 'Complete peace of mind',
  monthly: null,
  setup: null,
  marketingMonthly: 435,
  bullets: [
    'Everything in Pro',
    'Audit Protection included',
    'Dedicated accountant',
    'Monthly strategy consult',
  ],
}

export const PAYROLL = {
  baseMonthly: 50,
  baseSetup: 250,
  ownerManualPerEmp: 7,
  ellaStaffPerEmp: 10,
}

export const CASH_PLAN = {
  setup: 1000,
  perEmployeeMonthly: 5,
  perOwnerMonthly: 50,
}

export const AUDIT_PROTECTION = {
  monthly: 300,
  setup: 1000,
}

export const ONE_TIME = {
  startLlc: 1500,
  holdingLlcNew: 4000,
  holdingLlcModify: 1000,
  personalTaxReturn: 150,
  businessTaxReturnFederal: 800,
  businessTaxReturnState: 100,
}

export const SALES_TAX_MONITORING_MONTHLY = 25
