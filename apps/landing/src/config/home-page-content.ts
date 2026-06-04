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
    label: "Audit protection and compliance",
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
    title: "Audit protection",
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
    title: "AI Classifies & Renames",
    description:
      "Ella classifies the document, extracts data, and renames it: '2024_W2_Employer_ClientName.pdf'.",
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
    role: "EA",
    image: "/assets/team/tuyet-duong.png",
    bio: "Supports tax advisory conversations, business records, and compliance questions.",
  },
  {
    name: "Nancy Nguyen",
    headlineRole: "Former IRS Examiner",
    role: "Former IRS Examiner",
    image: "/assets/team/nancy-nguyen.png",
    bio: "Helps clients start the process, coordinate records, and keep the next step clear.",
  },
  {
    name: "Mr. Michael D. Sullivan",
    headlineRole: "Former IRS Agent",
    role: "Former IRS Agent",
    image: "/assets/team/michael-d-sullivan.png",
    bio: "Brings former IRS agent experience and decades of private tax practice to complex IRS resolution matters.",
    details: [
      "Michael D. Sullivan is the founder of MD Sullivan Tax Group and spent 10 years with the Internal Revenue Service before building more than 42 years of private tax practice experience.",
      "As a former IRS Revenue Officer and Agent, he handled Offer in Compromise matters, large-dollar cases, and complex audit and collection issues for individuals and businesses.",
      "He also served as a certified IRS teaching instructor, trained new IRS agents, earned multiple IRS awards, and has appeared on national tax and business news programs.",
    ],
  },
  {
    name: "Herb Cantor",
    headlineRole: "CPA",
    role: "Former IRS Revenue Agent / IRS Appeal Agent",
    image: "/assets/team/herb-cantor.jpg",
    bio: "Supports tax resolution matters with CPA experience and former IRS Revenue Agent and IRS Appeal Agent perspective.",
    details: [
      "Herb Cantor is a CPA, CGMA, and tax professional with a master's degree in taxation and deep IRS examination and appeals experience.",
      "He worked in the IRS Small Business Division, Appeals Division, and Large Case Division, including hundreds of appeal matters and major corporate examinations.",
      "His background covers individual and corporate examinations, Offers in Compromise, Tax Court-bound matters, penalty issues, and IRS negotiation strategy.",
    ],
  },
  {
    name: "John S. Wood",
    headlineRole: "CPA",
    role: "IRS Tax Resolution Expert",
    image: "/assets/team/john-s-wood.png",
    bio: "Helps clients approach IRS tax resolution questions with CPA guidance and tax controversy experience.",
    details: [
      "John S. Wood brings more than 29 years of tax and accounting experience and has held his CPA license since 1997.",
      "He has helped thousands of individuals and businesses resolve IRS issues, including liens, levies, audits, collections, and tax controversy matters.",
      "Before his own firm, he served as Assistant Controller at Outback Steakhouse's headquarters, bringing corporate accounting discipline to resolution work.",
    ],
  },
  {
    name: "Peter Salinger",
    headlineRole: "EA",
    role: "Former IRS Revenue Officer / IRS Appeals Settlement Officer",
    image: "/assets/team/peter-salinger.jpg",
    bio: "Supports IRS resolution work with enrolled agent credentials and former IRS Revenue Officer and Appeals Settlement Officer experience.",
    details: [
      "Peter Salinger began his IRS career in 1986 as a Revenue Officer and later managed Revenue Officers, training groups, and Offer in Compromise work.",
      "He became a Collection Branch Chief overseeing multiple managers and approximately 75 employees before moving into IRS Appeals.",
      "As an Appeals Settlement Officer, he handled collection due process, penalties, rejected offers, trust fund recovery issues, and reviewed several thousand offers over his career.",
    ],
  },
  {
    name: "Julie Lynch",
    headlineRole: "EA",
    role: "Former IRS Agent & Trust Fund Recovery Specialist",
    image: "/assets/team/julie-lynch.jpg",
    bio: "Helps clients understand IRS issues with former IRS Agent experience and enrolled agent representation support.",
    details: [
      "Julie Lynch retired after a 38-year career as an IRS Revenue Officer in the Collection Division, working cases for both individuals and businesses.",
      "Her IRS work included Offers in Compromise, installment agreements, currently-not-collectible cases, abatements, and trust fund recovery concerns.",
      "She taught IRS classes, mentored newer employees, worked with IRS Counsel and the U.S. Attorney's Office, and received major IRS service awards.",
    ],
  },
] as const;

export const homeFaqs = [
  {
    question: "Can I file fully online with Ella Tax Services?",
    answer: "Yes. Ella Tax Services supports online document collection, advisor review, signatures, and follow-up for tax preparation, tax resolution, audit protection, and compliance needs.",
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
