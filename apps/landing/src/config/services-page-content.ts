export const serviceDetails = [
  {
    audience: "Tax resolution",
    title: "Tax resolution",
    description: "IRS and state notice support for clients who need a clear plan, organized records, and response next steps.",
    bullets: ["Solves notice, balance, penalty, and unfiled-year pressure", "For IRS or state tax notice recipients", "Reviews notices, account facts, prior returns, payments, and records", "Delivers a resolution action plan and response preparation support"],
  },
  {
    audience: "Audit protection",
    title: "Audit protection",
    description: "Advisor-supported protection for return positions, documentation, and communication if tax agencies ask questions.",
    bullets: ["Solves audit documentation gaps", "For individuals, owners, and businesses with more complex returns", "Reviews deductions, credits, books, receipts, payroll, and source records", "Delivers audit-ready record organization and response coordination"],
  },
  {
    audience: "Compliance",
    title: "Compliance",
    description: "Year-round support for filings, deadlines, entity obligations, payroll records, sales tax, and franchise tax.",
    bullets: ["Solves missed filing and deadline risk", "For households, self-employed clients, and small businesses", "Reviews filing requirements, calendars, books, payroll reports, and state obligations", "Delivers compliance next steps and deadline-aware follow-up"],
  },
  {
    audience: "Compliance",
    title: "Individual and business tax preparation",
    description: "Federal and state return preparation built around compliance, accurate records, and advisor review.",
    bullets: ["Solves annual filing complexity", "For W-2, 1099, investment, rental, Schedule C, and entity returns", "Collects income forms, deductions, credits, business records, and filing details", "Delivers reviewed return preparation and filing next steps"],
  },
  {
    audience: "Audit protection",
    title: "Bookkeeping and cleanup",
    description: "Cleanup and recurring bookkeeping support that helps make records tax-ready and audit-ready.",
    bullets: ["Solves messy or incomplete books", "For owners preparing for filings, notices, or audit questions", "Reviews bank activity, categories, receipts, and open questions", "Delivers cleaner books and tax-ready summaries"],
  },
  {
    audience: "Compliance",
    title: "Payroll coordination",
    description: "Payroll tax record coordination with your existing provider and compliance workflow.",
    bullets: ["Solves disconnected payroll records", "For employers and owner-operators", "Reviews payroll reports, wage forms, and filing status", "Delivers record coordination for tax preparation"],
  },
  {
    audience: "Compliance",
    title: "Sales tax and franchise tax",
    description: "State compliance support for sales tax, franchise tax, deadlines, and records.",
    bullets: ["Solves state filing confusion", "For small businesses with sales or entity obligations", "Reviews filing requirements, sales records, and prior filings", "Delivers filing support and compliance next steps"],
  },
  {
    audience: "Tax resolution",
    title: "IRS and state notices",
    description: "Help understanding notices, response deadlines, balances, penalties, and the facts needed for a response.",
    bullets: ["Solves unclear notice language and deadline risk", "For IRS or state tax notice recipients", "Reviews notice letters, prior returns, payments, and records", "Delivers an action plan and response preparation support"],
  },
  {
    audience: "Compliance",
    title: "Entity and business advisory",
    description: "Practical consultation on entity structure, compliance review, cleanup priorities, and tax tradeoffs.",
    bullets: ["Solves uncertainty before business decisions", "For owners starting, changing, or cleaning up operations", "Reviews business model, filings, records, and obligations", "Delivers advisor recommendations and prioritized next steps"],
  },
] as const;

export const onlineServiceSupport = [
  {
    label: "Document collection",
    description: "Ella gives a service-specific checklist for resolution, audit protection, compliance, or filing work.",
  },
  {
    label: "Advisor review",
    description: "An advisor reviews records and asks clarifying questions.",
  },
  {
    label: "Audit-ready records",
    description: "Books, receipts, payroll records, sales tax, and franchise tax support can be coordinated together.",
  },
  {
    label: "Resolution planning",
    description: "The team helps organize notice response next steps and compliance conversations.",
  },
] as const;

export const servicesProcessSteps = [
  {
    title: "Intake",
    description: "Ella confirms whether you need resolution, audit protection, compliance, filing, or advisory support.",
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
    description: "Ella prepares the filing, cleanup, compliance, resolution, or audit-support work.",
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
    answer: "No. Ella focuses on tax resolution, audit protection, and compliance, with support for individuals, families, self-employed clients, small businesses, bookkeeping cleanup, payroll records, sales tax, franchise tax, notices, and advisory questions.",
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
