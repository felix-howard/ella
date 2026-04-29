/**
 * Pricing constants for Ella Tax services — rates, tiers, one-time fees.
 *
 * Marketing card prices (`marketingMonthly`) bundle typical add-ons and
 * intentionally differ from the bare tier `monthly` rate used by the calculator.
 * All dollar amounts are integer USD — never floats — so sums stay exact.
 */

export const TIER_BASIC = {
  id: "basic" as const,
  label: "Basic",
  tagline: "For small shops starting out",
  monthly: 75,
  setup: 150,
  marketingMonthly: 125,
  maxNec1099: 10,
  bullets: [
    "Bookkeeping + quarterly reviews",
    "Payroll base included",
    "Up to 10 workers (1099-NEC)",
    "Email support",
  ],
};

export const TIER_PRO = {
  id: "pro" as const,
  label: "Pro",
  tagline: "For growing salons",
  monthly: 85,
  setup: 150,
  marketingMonthly: 135,
  maxNec1099: 20,
  bullets: [
    "Everything in Basic",
    "11-20 workers (1099-NEC)",
    "Priority email + SMS support",
    "Monthly accountant check-ins",
  ],
};

export const TIER_ENTERPRISE = {
  id: "enterprise" as const,
  label: "Enterprise — Contact Us",
  marketingLabel: "VIP",
  tagline: "Complete peace of mind",
  monthly: null,
  setup: null,
  marketingMonthly: 435,
  bullets: [
    "Everything in Pro",
    "Audit Protection included",
    "Dedicated accountant",
    "Monthly strategy consult",
  ],
};

export const PAYROLL = {
  baseMonthly: 50,
  baseSetup: 250,
  ownerManualPerEmp: 7,
  ellaStaffPerEmp: 10,
};

export const CASH_PLAN = {
  setup: 1000,
  perEmployeeMonthly: 5,
  perOwnerMonthly: 50,
};

export const AUDIT_PROTECTION = {
  monthly: 300,
  setup: 500,
};

/**
 * Per-unit rate defaults for one-time services. Used as both calculator
 * defaults and marketing display prices.
 *
 * Business tax return is split into federal + state components so operators
 * can price them independently on the internal calculator. The displayed
 * total is `businessTaxReturnFederal + businessTaxReturnState`.
 */
export const ONE_TIME = {
  startLlc: 1500,
  holdingLlcNew: 4000,
  holdingLlcModify: 1000,
  personalTaxReturn: 150,
  businessTaxReturnFederal: 600,
  businessTaxReturnState: 100,
};

export const SALES_TAX_MONITORING_MONTHLY = 25;
