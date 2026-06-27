export const TIER_BASIC = {
  id: 'basic' as const,
  label: '0-10 workers',
  tagline: 'For smaller contractor teams',
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
  label: '11-20 workers',
  tagline: 'For growing contractor teams',
  monthly: 85,
  setup: 150,
  marketingMonthly: 135,
  maxNec1099: 20,
  bullets: [
    'Bookkeeping + quarterly reviews',
    '11-20 workers (1099-NEC)',
    'Priority email + SMS support',
    'Monthly accountant check-ins',
  ],
}

export const TIER_ENTERPRISE = {
  id: 'enterprise' as const,
  label: 'Enterprise — Contact Us',
  marketingLabel: '21+ workers',
  tagline: 'For larger contractor teams',
  monthly: null,
  setup: null,
  marketingMonthly: 435,
  bullets: [
    'Larger 1099-NEC worker counts',
    'Audit Detection included',
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
