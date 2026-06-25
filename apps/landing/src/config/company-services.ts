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
    audience: "Tax resolution",
    description:
      "IRS and state notice support for clients who need a clear response path.",
    services: [
      {
        name: "IRS and state notice help",
        description: "Review notices, deadlines, account facts, and response options.",
      },
      {
        name: "Back tax and balance support",
        description: "Organize prior-year filings, payment history, penalties, and next steps.",
      },
      {
        name: "Resolution document preparation",
        description: "Build the record package needed for advisor review and response work.",
      },
    ],
  },
  {
    audience: "Audit detection",
    description:
      "Return support, records, and advisor coordination before and during audit questions.",
    services: [
      {
        name: "Audit-ready return review",
        description: "Review tax positions, deductions, credits, and supporting records.",
      },
      {
        name: "Record organization",
        description: "Prepare books, receipts, payroll reports, and source documents for review.",
      },
      {
        name: "Audit response coordination",
        description: "Coordinate facts, documents, and advisor follow-up for IRS or state inquiries.",
      },
    ],
  },
  {
    audience: "Compliance",
    description:
      "Ongoing filing and record support for individuals and business owners.",
    services: [
      {
        name: "Individual and business tax preparation",
        description: "Federal and state return support with compliance-focused document review.",
      },
      {
        name: "Payroll, sales tax, and franchise tax",
        description: "Coordinate recurring obligations, reports, filing support, and deadlines.",
      },
      {
        name: "Bookkeeping cleanup",
        description: "Clean up records so filings, notices, and audit questions are easier to support.",
      },
    ],
  },
  {
    audience: "Advisory support",
    description:
      "Planning conversations tied to compliance, resolution risk, and operating decisions.",
    services: [
      {
        name: "Tax advisory",
        description: "Advisor-led guidance for tax strategy, documentation, and decision support.",
      },
      {
        name: "Entity structure consultation",
        description: "Practical consultation on entity setup, tax considerations, and compliance responsibilities.",
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
