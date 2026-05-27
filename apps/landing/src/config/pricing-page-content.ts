import {
  AUDIT_PROTECTION,
  PAYROLL,
  TIER_BASIC,
  TIER_ENTERPRISE,
  TIER_PRO,
} from "@/config/pricing";

export const pricingTierCards = [
  {
    id: "basic" as const,
    name: TIER_BASIC.label,
    tagline: TIER_BASIC.tagline,
    monthlyPrice: TIER_BASIC.marketingMonthly,
    priceNote: "typical salon setup",
    setupFee: TIER_BASIC.setup,
    payrollSetupFee: PAYROLL.baseSetup,
    bullets: TIER_BASIC.bullets,
    breakdownHeading: "How it adds up",
    breakdown: [
      {
        label: `Basic tier (\u2264${TIER_BASIC.maxNec1099} workers)`,
        amount: TIER_BASIC.monthly,
      },
      { label: "+ Payroll base", amount: PAYROLL.baseMonthly },
    ],
    popular: false,
  },
  {
    id: "pro" as const,
    name: TIER_PRO.label,
    tagline: TIER_PRO.tagline,
    monthlyPrice: TIER_PRO.marketingMonthly,
    priceNote: "typical salon setup",
    setupFee: TIER_PRO.setup,
    payrollSetupFee: PAYROLL.baseSetup,
    bullets: TIER_PRO.bullets,
    breakdownHeading: "How it adds up",
    breakdown: [
      {
        label: `Pro tier (${TIER_BASIC.maxNec1099 + 1}\u2013${TIER_PRO.maxNec1099} workers)`,
        amount: TIER_PRO.monthly,
      },
      { label: "+ Payroll base", amount: PAYROLL.baseMonthly },
    ],
    popular: true,
  },
  {
    id: "vip" as const,
    name: TIER_ENTERPRISE.marketingLabel,
    tagline: TIER_ENTERPRISE.tagline,
    monthlyPrice: TIER_ENTERPRISE.marketingMonthly,
    priceNote: "typical premium bundle",
    setupNote: "Custom setup quote",
    bullets: TIER_ENTERPRISE.bullets,
    breakdownHeading: "How it adds up",
    breakdown: [
      {
        label: `Pro tier (${TIER_BASIC.maxNec1099 + 1}\u2013${TIER_PRO.maxNec1099} workers)`,
        amount: TIER_PRO.monthly,
      },
      { label: "+ Payroll base", amount: PAYROLL.baseMonthly },
      { label: "+ Audit Protection", amount: AUDIT_PROTECTION.monthly },
    ],
    popular: false,
  },
] as const;

export const pricingPackages = [
  {
    title: "Individual Tax Preparation",
    price: "Starting at $150",
    description:
      "Federal and state return preparation for individuals and families with online document collection and advisor review.",
    bullets: [
      "W-2 and 1099 income support",
      "Credits and deduction review",
      "State filing coordination",
    ],
    featured: false,
  },
  {
    title: "Business Tax Preparation",
    price: "Starting at $700",
    description:
      "Entity return preparation and owner coordination for small businesses, contractors, and multi-state considerations.",
    bullets: [
      "Federal and state business returns",
      "Owner tax coordination",
      "Bookkeeping readiness review",
    ],
    featured: true,
  },
  {
    title: "Bookkeeping and Cleanup",
    price: "Quoted after review",
    description:
      "Monthly bookkeeping, catch-up cleanup, and tax-ready record organization for owners who need practical support.",
    bullets: [
      "Record cleanup planning",
      "Monthly bookkeeping options",
      "Tax filing handoff support",
    ],
    featured: false,
  },
  {
    title: "Tax Advisory and Planning",
    price: "By consultation",
    description:
      "Advisor-led planning for withholding, estimated payments, entity structure, compliance questions, and owner decisions.",
    bullets: [
      "Planning calls",
      "Tax notice review",
      "Entity structure consultation",
    ],
    featured: false,
  },
] as const;

export const complianceServices = [
  "Payroll coordination",
  "Sales tax filing support",
  "Franchise tax support",
  "LLC formation and changes",
  "Tax notice help",
  "Business advisory",
] as const;
