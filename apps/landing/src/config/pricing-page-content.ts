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
