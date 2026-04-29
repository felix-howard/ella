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
    question: "How is my final price calculated?",
    answer:
      "Your monthly total combines the tier fee (Basic or Pro), payroll (if enabled), optional Cash Plan costs per employee and owner, optional Audit Protection, and sales tax monitoring per shop. One-time setup adds the tier setup fee plus any LLC or tax-return add-ons you select. The calculator above shows the itemized breakdown in real time.",
  },
  {
    question: "What's the difference between the 3 tiers?",
    answer:
      "Basic ($75/mo, $150 setup) fits solo operators and small teams filing up to 10 1099 workers. Pro ($85/mo, $150 setup) covers 11-20 1099 workers plus priority support. VIP is a custom-scoped engagement for 21+ 1099 workers or multi-entity operations — pricing by quote.",
  },
  {
    question: "Can I upgrade or downgrade my plan later?",
    answer:
      "Yes. Tier changes take effect on your next billing cycle with no penalty. Add-on services like Audit Protection or Cash Plan can be toggled any month; monthly fees prorate automatically.",
  },
  {
    question: "What counts as a \"1099 worker\"?",
    answer:
      "A 1099 worker is any independent contractor you pay $600 or more during the tax year — typically nail technicians, stylists, or other service contractors in salons and small shops. Your 1099 count determines your tier and drives your annual Form 1099-NEC filings with the IRS.",
  },
  {
    question: "What's included in Audit Protection?",
    answer:
      "Audit Protection ($300/mo, $500 one-time setup) covers representation if the IRS or a state agency audits any return we prepared. We handle document requests, correspondence, and in-person meetings with the examiner on your behalf — so you keep running your business.",
  },
  {
    question: "How does Cash Plan work?",
    answer:
      "Cash Plan is a payroll-based benefit program with a $1,000 one-time setup, then $5/mo per enrolled employee and $50/mo per owner or shareholder. We configure the plan with your payroll provider and manage ongoing contributions and year-end reporting.",
  },
  {
    question: "Is the $300 consultation deposit refundable?",
    answer:
      "Yes — the $300 deposit is fully refundable against your first invoice if you sign up with Ella Tax after the consultation. If you decide not to move forward, the deposit covers the accountant's time for the session.",
  },
  {
    question: "Do you serve businesses outside your home state?",
    answer:
      "We file federal returns for clients nationwide and state returns in every state where we're registered. If you operate across multiple states, let us know during the consultation and we'll confirm coverage for your specific jurisdictions before you sign up.",
  },
];
