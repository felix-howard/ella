import { siteConfig } from "@/config/site";

export const homeTrustItems = [
  {
    label: "Houston-based company",
    description: "Ella Tax Services LLC serves clients online from Houston, TX.",
  },
  {
    label: "Authorized IRS e-file Provider",
    description: "Electronically file eligible federal returns after advisor review.",
  },
  {
    label: "Tax resolution focus",
    description: "Get organized support for IRS and state notices, balances, and response next steps.",
  },
  {
    label: "Audit detection and compliance",
    description: "Prepare records, deadlines, filings, and documentation before problems escalate.",
  },
] as const;

export const homeServiceHighlights = [
  {
    title: "Tax resolution",
    description: "Support for IRS and state notices, balances due, unfiled years, penalties, and response planning.",
    bullets: ["Notice and account review", "Document checklist", "Resolution next steps"],
  },
  {
    title: "Audit detection",
    description: "Help clients keep return positions, records, and communication ready if the IRS or state asks questions.",
    bullets: ["Return support review", "Record organization", "Advisor response coordination"],
  },
  {
    title: "Compliance",
    description: "Year-round support for filings, payroll records, sales tax, franchise tax, and business obligations.",
    bullets: ["Compliance calendar", "Filing requirement review", "Deadline-aware follow-up"],
  },
  {
    title: "Tax preparation",
    description: "Federal and state return preparation built around compliance, clean records, and advisor review.",
    bullets: ["Individual and business returns", "Deduction and credit review", "E-file coordination"],
  },
  {
    title: "Bookkeeping cleanup",
    description: "Clean up books and supporting records so compliance filings and audit questions are easier to handle.",
    bullets: ["Prior-period cleanup", "Expense category review", "Tax-ready summaries"],
  },
  {
    title: "Payroll and state filings",
    description: "Coordinate payroll reports, sales tax, franchise tax, and entity records with your filing workflow.",
    bullets: ["Payroll report review", "State filing support", "Compliance record collection"],
  },
  {
    title: "IRS and state notices",
    description: "Help reading notices, tracking deadlines, and organizing facts needed for response preparation.",
    bullets: ["Notice triage", "Deadline tracking", "Response preparation support"],
  },
  {
    title: "Business advisory",
    description: "Discuss structure, cleanup priorities, compliance gaps, and tax tradeoffs with an advisor.",
    bullets: ["Entity structure consultation", "Compliance review", "Owner advisory"],
  },
] as const;

export const homeHowItWorksSteps = [
  {
    step: "1",
    title: "Client Texts Photo",
    description:
      "Client snaps a photo of their tax document and texts it to your firm's Ella number. No app required.",
  },
  {
    step: "2",
    title: "Organized for Advisor Review",
    description:
      "Ella organizes the upload, confirms key details, and labels the record clearly for advisor review.",
  },
  {
    step: "3",
    title: "Review & Prepare",
    description:
      "Your team reviews organized documents, completes the checklist, and prepares the return.",
  },
] as const;

export const homeAudienceSegments = [
  "Individuals and families facing IRS or state notices, balances, or audit questions.",
  "Self-employed and 1099 workers who need records ready for tax filings and audits.",
  "Small businesses and LLCs coordinating books, payroll, sales tax, and compliance deadlines.",
  "Local service businesses, shops, and salons that need practical compliance protection.",
] as const;

export const homeAdvisors = [
  {
    name: "Tuyet Duong",
    headlineRole: "EA",
    role: "Senior Tax Advisor, Enrolled Agent (EA)",
    image: "/assets/team/tuyet-duong.png",
    bio: "Over 10 years of experience serving the nail salon industry, specializing in tax planning, compliance, business structuring, audit representation, and regulatory compliance.",
  },
  {
    name: "Nancy Nguyen, Former IRS Tax Examiner",
    role: "Senior Tax Accountant & Former IRS Tax Examiner",
    image: "/assets/team/nancy-nguyen.png",
    bio: "With over a decade of experience in tax accounting and over 5 years of expertise in examining small business tax matters for the IRS.",
    details: [
      "Specialize in tax accounting, financial record reconstruction, and audit support documentation.",
    ],
  },
  {
    name: "Michael D. Sullivan, Former IRS Revenue Officer",
    role: "Senior Tax Resolution Consultant & Former IRS Revenue Officer",
    image: "/assets/team/michael-d-sullivan.png",
    bio: "Former IRS Revenue Officer with 10 years of government service and 42 years in private tax practice. Specializes in Offer in Compromise cases, large-dollar tax liabilities, complex audits, and collection matters.",
  },
  {
    name: "Herb Cantor",
    headlineRole: "CPA",
    role: "Certified Public Accountant (CPA) & Former IRS Agent",
    image: "/assets/team/herb-cantor.jpg",
    bio: "More than 30 years of experience with the IRS Small Business Division, Appeals Division, and Large Case Division. Specializes in Tax Court matters, penalty abatement, appeals, and IRS negotiation strategies.",
  },
  {
    name: "John S. Wood",
    headlineRole: "CPA",
    role: "Certified Public Accountant (CPA) & Tax Controversy Specialist",
    image: "/assets/team/john-s-wood.png",
    bio: "Over 29 years of tax and accounting experience. Specializes in tax liens, levies, audits, collections, and IRS controversy resolution.",
  },
  {
    name: "Peter Salinger",
    headlineRole: "EA",
    role: "Enrolled Agent (EA) & Former IRS Collection Branch Chief",
    image: "/assets/team/peter-salinger.jpg",
    bio: "Former IRS Revenue Officer and Collection Branch Chief with more than 30 years of IRS experience. Specializes in Offer in Compromise, collection matters, rejected offers, installment agreements, and penalty abatement.",
  },
  {
    name: "Julie Lynch",
    headlineRole: "EA",
    role: "Enrolled Agent (EA) & Former IRS Revenue Officer",
    image: "/assets/team/julie-lynch.jpg",
    bio: "Completed a distinguished 38-year career with the IRS Collection Division. Specializes in Trust Fund Recovery Penalty investigations, collection enforcement, and payroll tax compliance matters.",
  },
] as const;

export const homeFaqs = [
  {
    question: "Can I file fully online with Ella Tax Services?",
    answer: "Yes. Ella Tax Services supports online document collection, advisor review, signatures, and follow-up for tax preparation, tax resolution, audit detection, and compliance needs.",
  },
  {
    question: "What documents do I need to start?",
    answer: "The team will ask for income forms, identity and filing details, deduction records, business records, notices, or bookkeeping reports based on the service you request.",
  },
  {
    question: "Do you help businesses?",
    answer: "Yes. Ella helps small businesses with tax preparation, bookkeeping cleanup, payroll record coordination, sales tax, franchise tax, audit-ready records, and compliance questions.",
  },
  {
    question: "Can you help with IRS or state notices?",
    answer: "Yes. Ella can review the notice, explain common resolution paths, track deadlines, and help organize the information needed for a response.",
  },
  {
    question: "How do I start?",
    answer: `Start online, call ${siteConfig.contact.phone}, or email ${siteConfig.contact.email}. The team will follow up with the next step.`,
  },
] as const;
