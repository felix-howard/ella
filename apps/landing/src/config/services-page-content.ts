export const serviceDetails = [
  {
    audience: "Individual tax",
    title: "Individual tax preparation",
    description: "Online federal and state return support for individuals, families, and households with multiple income sources.",
    bullets: ["Solves annual filing complexity", "For W-2, 1099, investment, rental, and family returns", "Collects income forms, deductions, credits, and filing details", "Delivers reviewed return preparation and filing next steps"],
  },
  {
    audience: "Business tax",
    title: "Business tax preparation",
    description: "Preparation support for small business filings with owner tax coordination and clean records.",
    bullets: ["Solves year-end business filing pressure", "For LLCs, small businesses, contractors, and service firms", "Reviews books, contractor records, payroll reports, and deductions", "Delivers prepared business filings and owner coordination"],
  },
  {
    audience: "Advisory",
    title: "Tax advisory and planning",
    description: "Advisor-led planning for estimates, withholding, tax events, and business decisions.",
    bullets: ["Solves reactive tax decisions", "For clients with changing income, business growth, or planned transactions", "Reviews goals, prior filings, income changes, and timing", "Delivers practical planning guidance and next actions"],
  },
  {
    audience: "Bookkeeping",
    title: "Bookkeeping and cleanup",
    description: "Cleanup and recurring bookkeeping support that helps make records tax-ready.",
    bullets: ["Solves messy or incomplete books", "For owners preparing for filing or regular reporting", "Reviews bank activity, categories, receipts, and open questions", "Delivers cleaner books and tax-ready summaries"],
  },
  {
    audience: "Compliance",
    title: "Payroll coordination",
    description: "Payroll tax record coordination with your existing provider and filing workflow.",
    bullets: ["Solves disconnected payroll records", "For employers and owner-operators", "Reviews payroll reports, wage forms, and filing status", "Delivers record coordination for tax preparation"],
  },
  {
    audience: "Compliance",
    title: "Sales tax and franchise tax",
    description: "State compliance support for sales tax, franchise tax, deadlines, and records.",
    bullets: ["Solves state filing confusion", "For small businesses with sales or entity obligations", "Reviews filing requirements, sales records, and prior filings", "Delivers filing support and compliance next steps"],
  },
  {
    audience: "Notice help",
    title: "IRS and state notices",
    description: "Help understanding notices and organizing the facts needed for a response.",
    bullets: ["Solves unclear notice language and deadline risk", "For IRS or state tax notice recipients", "Reviews notice letters, prior returns, payments, and records", "Delivers an action plan and response preparation support"],
  },
  {
    audience: "Business advisory",
    title: "Entity and business advisory",
    description: "Practical consultation on entity structure, compliance review, cleanup priorities, and tax tradeoffs.",
    bullets: ["Solves uncertainty before business decisions", "For owners starting, changing, or cleaning up operations", "Reviews business model, filings, records, and obligations", "Delivers advisor recommendations and prioritized next steps"],
  },
] as const;

export const servicesComparison = [
  {
    label: "Document collection",
    diy: "You track every form and missing item yourself.",
    ella: "Ella gives a service-specific checklist and follows up on open items.",
  },
  {
    label: "Review",
    diy: "Software depends on what you enter and understand.",
    ella: "An advisor reviews records and asks clarifying questions.",
  },
  {
    label: "Business support",
    diy: "Business books, payroll, and state filings often sit outside the flow.",
    ella: "Tax, books, payroll records, sales tax, and franchise tax can be coordinated together.",
  },
  {
    label: "Notices and planning",
    diy: "Notice responses and planning questions require separate research.",
    ella: "The team helps organize notice next steps and planning conversations.",
  },
] as const;

export const servicesProcessSteps = [
  {
    title: "Intake",
    description: "Ella confirms your service need, timeline, and contact path.",
  },
  {
    title: "Document collection",
    description: "You share tax forms, books, notices, payroll reports, or business records.",
  },
  {
    title: "Advisor review",
    description: "The team checks open items and asks targeted follow-up questions.",
  },
  {
    title: "Preparation",
    description: "Ella prepares the filing, cleanup, compliance, or advisory work.",
  },
  {
    title: "Client review",
    description: "You review the prepared work and complete signatures or approvals.",
  },
  {
    title: "Filing and follow-up",
    description: "Ella helps with submission steps, records, and remaining next actions.",
  },
] as const;

export const servicesFaqs = [
  {
    question: "Do I need to visit an office?",
    answer: "Most Ella Tax Services workflows can start online. The team can coordinate documents, review, and follow-up remotely.",
  },
  {
    question: "Do you only prepare individual returns?",
    answer: "No. Ella supports individuals, families, self-employed clients, small businesses, bookkeeping, payroll records, sales tax, franchise tax, notices, and advisory questions.",
  },
  {
    question: "Can Ella clean up books before tax filing?",
    answer: "Yes. Ella can help with bookkeeping cleanup and tax-ready summaries when business records need organization before filing.",
  },
  {
    question: "Can you guarantee a tax result?",
    answer: "No. Ella provides preparation, review, and advisory support based on your facts and applicable requirements, but does not promise a specific refund or tax outcome.",
  },
] as const;
