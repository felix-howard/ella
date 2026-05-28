export interface ServiceItem {
  name: string;
  description: string;
}

export interface ServiceCategory {
  audience: string;
  description: string;
  services: ServiceItem[];
}

export const serviceCategories: ServiceCategory[] = [
  {
    audience: "Individual tax services",
    description:
      "Online filing support for annual returns, tax notices, and planning questions.",
    services: [
      {
        name: "Individual tax preparation",
        description: "Federal and state return preparation with secure online document collection.",
      },
      {
        name: "Tax notice help",
        description: "Review and response guidance for IRS and state tax notices.",
      },
      {
        name: "Tax planning",
        description: "Year-round planning for withholding, estimated taxes, and household changes.",
      },
    ],
  },
  {
    audience: "Business tax services",
    description:
      "Tax, books, and compliance support for owners who need practical online service.",
    services: [
      {
        name: "Business tax preparation",
        description: "Entity and owner return coordination for small business filings.",
      },
      {
        name: "Bookkeeping",
        description: "Recurring bookkeeping and cleanup support for tax-ready records.",
      },
      {
        name: "Payroll coordination",
        description: "Payroll tax coordination with existing providers and records.",
      },
      {
        name: "Sales tax and franchise tax",
        description: "Filing support for state sales tax and franchise tax obligations.",
      },
      {
        name: "Compliance review",
        description: "Review of filing requirements, deadlines, and missing records.",
      },
    ],
  },
  {
    audience: "Advisory services",
    description:
      "Planning conversations for business structure, tax decisions, and operating questions.",
    services: [
      {
        name: "Tax advisory",
        description: "Advisor-led guidance for business tax strategy and decision support.",
      },
      {
        name: "Entity structure consultation",
        description: "Practical consultation on entity setup and tax considerations.",
      },
      {
        name: "Business advisory",
        description: "Support for owner questions, cleanup priorities, and planning tradeoffs.",
      },
    ],
  },
] as const;

export const serviceNames = serviceCategories.flatMap((category) =>
  category.services.map((service) => service.name)
);
