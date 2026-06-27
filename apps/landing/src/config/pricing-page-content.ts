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
        label: `Monthly service (\u2264${TIER_BASIC.maxNec1099} workers)`,
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
        label: `Monthly service (${TIER_BASIC.maxNec1099 + 1}\u2013${TIER_PRO.maxNec1099} workers)`,
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
        label: `Monthly service (${TIER_BASIC.maxNec1099 + 1}\u2013${TIER_PRO.maxNec1099} workers)`,
        amount: TIER_PRO.monthly,
      },
      { label: "+ Payroll base", amount: PAYROLL.baseMonthly },
      { label: "+ Audit Detection", amount: AUDIT_PROTECTION.monthly },
    ],
    popular: false,
  },
] as const;

export const pricingPackages = [
  {
    title: "Tax Resolution",
    price: "Starting at $150",
    description:
      "Notice review and response planning for IRS and state tax issues, balances, penalties, and unfiled-year questions.",
    bullets: [
      "IRS and state notice review",
      "Deadline and document checklist",
      "Resolution next-step plan",
    ],
    featured: false,
  },
  {
    title: "Audit Detection",
    price: "Starting at $700",
    description:
      "Audit-ready record review and advisor coordination for individuals and businesses with complex return positions.",
    bullets: [
      "Return support review",
      "Records and receipt organization",
      "Agency response coordination",
    ],
    featured: true,
  },
  {
    title: "Compliance Support",
    price: "Quoted after review",
    description:
      "Recurring and catch-up support for filings, books, payroll records, sales tax, franchise tax, and deadline management.",
    bullets: [
      "Compliance requirement review",
      "Bookkeeping cleanup planning",
      "State and payroll record support",
    ],
    featured: false,
  },
  {
    title: "Tax Preparation and Advisory",
    price: "By consultation",
    description:
      "Federal and state return preparation with advisor-led planning for withholding, estimates, entities, and owner decisions.",
    bullets: [
      "Individual and business filings",
      "Planning calls",
      "Entity structure consultation",
    ],
    featured: false,
  },
] as const;

export const complianceServices = [
  "Tax resolution",
  "Audit detection",
  "Payroll coordination",
  "Sales tax filing support",
  "Franchise tax support",
  "LLC formation and changes",
  "Tax notice help",
  "Business advisory",
] as const;
