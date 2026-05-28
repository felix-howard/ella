/**
 * FAQ items for the /pricing page.
 * Rendered twice: once as accessible HTML in the page body, once as
 * structured data via `faqSchema()` for SEO rich results.
 * Keep copy synchronized between the two by reading from this single source.
 */

export interface FaqItem {
  question: string;
  answer: string;
}

export const pricingFaqItems: FaqItem[] = [
  {
    question: "Are these final prices?",
    answer:
      "No. Published pricing is a starting point or service range. Final fees depend on tax year, filing states, entity type, bookkeeping condition, deadlines, notices, and the facts Ella Tax Services reviews before engagement.",
  },
  {
    question: "Why are some services quoted after review?",
    answer:
      "Bookkeeping cleanup, advisory, payroll coordination, sales tax, franchise tax, and notice work can vary significantly. Ella reviews scope first so the quote matches the actual work instead of a generic package.",
  },
  {
    question: "Do you require sensitive tax information to request a quote?",
    answer:
      "No. The public inquiry form asks for basic contact and service details only. Social Security numbers, Tax ID numbers, tax documents, and bank details should be shared only through secure onboarding after engagement.",
  },
  {
    question: "Do you offer online tax service outside Houston?",
    answer:
      "Yes. Ella Tax Services is Houston-based and supports online service workflows. We confirm state-specific requirements before work begins.",
  },
  {
    question: "Can Ella help if my books are not ready?",
    answer:
      "Yes. Bookkeeping cleanup can be scoped before tax preparation so records are organized enough for filing and advisory work.",
  },
  {
    question: "Is payment due before filing?",
    answer:
      "Fees and timing are confirmed during engagement. Some services may require payment before work starts or before completed filings are released.",
  },
];
