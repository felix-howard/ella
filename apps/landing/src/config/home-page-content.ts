import { siteConfig } from "@/config/site";

export const homeTrustItems = [
  {
    label: "Houston-based company",
    description: "Ella Tax Services LLC serves clients online from Houston, TX.",
  },
  {
    label: "Authorized IRS e-file Provider",
    description: "Electronically file eligible federal returns through Ella's online process.",
  },
  {
    label: "Individual and business support",
    description: "Get help with personal returns, business filings, books, and notices.",
  },
  {
    label: "IRS and state notice help",
    description: "Understand notices, deadlines, records, and response next steps.",
  },
] as const;

export const homeServiceHighlights = [
  {
    title: "Individual tax preparation",
    description: "Federal and state return support for individuals, families, and mixed income households.",
    bullets: ["W-2 and 1099 review", "Deduction and credit questions", "Advisor follow-up before filing"],
  },
  {
    title: "Business tax preparation",
    description: "Small business return preparation with owner records, contractor forms, and deadline coordination.",
    bullets: ["LLC and small business records", "Year-end filing coordination", "Tax-ready document review"],
  },
  {
    title: "Tax planning and advisory",
    description: "Practical planning for withholding, estimates, entity decisions, and tax impact questions.",
    bullets: ["Estimated tax review", "Business decision support", "Year-round advisory calls"],
  },
  {
    title: "Bookkeeping and cleanup",
    description: "Cleanup and recurring bookkeeping support so records are ready before tax deadlines.",
    bullets: ["Prior-period cleanup", "Expense category review", "Tax-ready summaries"],
  },
  {
    title: "Payroll coordination",
    description: "Coordinate payroll records, reports, and tax documents with your existing provider.",
    bullets: ["Payroll report review", "Tax form coordination", "Compliance calendar support"],
  },
  {
    title: "Sales and franchise tax",
    description: "Support for state sales tax, franchise tax, and compliance records for small businesses.",
    bullets: ["Filing requirement review", "Record collection", "Deadline-aware follow-up"],
  },
  {
    title: "IRS and state notices",
    description: "Help reading tax notices and organizing the facts needed for response preparation.",
    bullets: ["Notice review", "Document checklist", "Response next steps"],
  },
  {
    title: "Business and entity advisory",
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
  "Individuals and families filing annual federal and state returns.",
  "Self-employed and 1099 workers who need income and expense support.",
  "Small businesses and LLCs coordinating books, payroll, and filings.",
  "Local service businesses, shops, and salons that need practical compliance help.",
] as const;

export const homeAdvisors = [
  {
    name: "Nancy Nguyen",
    headlineRole: "Former IRS Examiner",
    role: "Former IRS Examiner",
    image: "/assets/team/nancy-nguyen.png",
    bio: "Helps clients start the process, coordinate records, and keep the next step clear.",
  },
  {
    name: "Tuyet Duong",
    headlineRole: "EA",
    role: "EA",
    image: "/assets/team/tuyet-duong.png",
    bio: "Supports tax advisory conversations, business records, and compliance questions.",
  },
  {
    name: "Mr. Michael D. Sullivan",
    headlineRole: "Former IRS Agent",
    role: "Former IRS Agent",
    image: "/assets/team/michael-d-sullivan.png",
    bio: "Brings former IRS agent experience and decades of private tax practice to complex IRS resolution matters.",
  },
  {
    name: "Herb Cantor",
    headlineRole: "CPA",
    role: "Former IRS Revenue Agent / IRS Appeal Agent",
    image: "/assets/team/herb-cantor.jpg",
    bio: "Supports tax resolution matters with CPA experience and former IRS Revenue Agent and IRS Appeal Agent perspective.",
  },
  {
    name: "John S. Wood",
    headlineRole: "CPA",
    role: "IRS Tax Resolution Expert",
    image: "/assets/team/john-s-wood.png",
    bio: "Helps clients approach IRS tax resolution questions with CPA guidance and tax controversy experience.",
  },
  {
    name: "Peter Salinger",
    headlineRole: "EA",
    role: "Former IRS Revenue Officer / IRS Appeals Settlement Officer",
    image: "/assets/team/peter-salinger.jpg",
    bio: "Supports IRS resolution work with enrolled agent credentials and former IRS Revenue Officer and Appeals Settlement Officer experience.",
  },
  {
    name: "Julie Lynch",
    headlineRole: "Enrolled Agent",
    role: "Former IRS Agent & Enrolled Agent",
    image: "/assets/team/julie-lynch.jpg",
    bio: "Helps clients understand IRS issues with former IRS Agent experience and enrolled agent representation support.",
  },
] as const;

export const homeFaqs = [
  {
    question: "Can I file fully online with Ella Tax Services?",
    answer: "Yes. Ella Tax Services supports online document collection, advisor review, signatures, and follow-up for many individual and business tax needs.",
  },
  {
    question: "What documents do I need to start?",
    answer: "The team will ask for income forms, identity and filing details, deduction records, business records, notices, or bookkeeping reports based on the service you request.",
  },
  {
    question: "Do you help businesses?",
    answer: "Yes. Ella helps small businesses with tax preparation, bookkeeping cleanup, payroll record coordination, sales tax, franchise tax, and advisory questions.",
  },
  {
    question: "Can you help with IRS or state notices?",
    answer: "Yes. Ella can review the notice, explain common next steps, and help organize the information needed for a response.",
  },
  {
    question: "How do I start?",
    answer: `Start online, call ${siteConfig.contact.phone}, or email ${siteConfig.contact.email}. The team will follow up with the next step.`,
  },
] as const;
