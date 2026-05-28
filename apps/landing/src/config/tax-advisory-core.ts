export const taxAdvisoryPasswordHash =
  "4654d793972c3b6a1d48fb0ab58d9cb0de46c3d33d605f9222c283dfaa12d420";
export const taxAdvisoryStorageKey = "ellaTaxAdvisoryAuth:1233";

export const heroMetrics = [
  { value: "01", label: "discovery and records review" },
  { value: "04", label: "planning checkpoints" },
  { value: "365", label: "day implementation view" },
];

export const helpPromises = [
  "Understand which tax planning topics fit your facts",
  "Review records before recommending implementation steps",
  "Coordinate tax planning, bookkeeping, payroll, and compliance needs",
  "Prepare estimated tax conversations before deadlines",
  "Document agreed next steps for filing and follow-up",
  "Keep planning recommendations tied to eligibility and records",
];

export const clientExperienceStages = [
  {
    number: "01",
    title: "Initial meeting",
    description: "Start the advisory relationship and understand the client facts.",
  },
  {
    number: "02",
    title: "Tax plan",
    description: "Build the strategy plan after return analysis and discovery.",
  },
  {
    number: "03",
    title: "Implementation",
    description: "Complete the work needed before strategies can be claimed.",
  },
  {
    number: "04",
    title: "Estimates",
    description: "Calculate estimated taxes and adjust the plan during the year.",
  },
  {
    number: "05",
    title: "Filing",
    description: "File with the strategies, documents, and signatures complete.",
  },
];

export const overpaymentReasons = [
  {
    title: "Late planning conversations",
    description: "Tax decisions are easier to evaluate before deadlines or major transactions.",
  },
  {
    title: "Incomplete records",
    description: "Missing bookkeeping, payroll, or entity records can limit planning options.",
  },
  {
    title: "Books do not match the return",
    description: "The return, books, payroll, and supporting records need to align.",
  },
  {
    title: "Weak documentation",
    description: "Planning positions need support from facts, records, and retained documentation.",
  },
  {
    title: "Implementation work not complete",
    description: "A strategy cannot be used if required actions are not completed on time.",
  },
];

export const serviceDeliverables = [
  {
    title: "Tax return analysis",
    highlights: ["Compliance", "Eligibility"],
    description: "Review prior-year filings, records, and current facts before recommending next steps.",
  },
  {
    title: "Tax plan",
    highlights: ["Clarity"],
    description: "Document the advisory topics, responsibilities, and follow-up schedule.",
  },
  {
    title: "Strategy report",
    highlights: ["Support"],
    description: "Keep planning recommendations tied to documents, eligibility, and compliance notes.",
  },
];

export const advisoryFlow = [
  { id: "initial", label: "Initial consultation", tone: "blue" },
  { id: "nda", label: "NDA", sublabel: "(non-disclosure agreement)", tone: "blue" },
  { id: "analysis", label: "Analysis consultation", tone: "blue" },
  { id: "proposal", label: "Price package proposal", tone: "blue" },
  { id: "engagement", label: "Engagement letter", sublabel: "(contract)", tone: "blue" },
  { id: "onboard", label: "Onboard, implement", tone: "green" },
  { id: "bookkeeping", label: "Bookkeeping", tone: "green" },
  { id: "records", label: "Organize planning records", tone: "green" },
  { id: "specialist", label: "Review by tax specialist", tone: "green" },
  {
    id: "zoom",
    label: "Review with client on Zoom",
    sublabel: "by account representative",
    tone: "purple",
  },
  { id: "sign", label: "Sign 8879", tone: "orange" },
  { id: "efile", label: "Efile", tone: "lime" },
  { id: "planning", label: "Tax planning", tone: "orange" },
];

export const processSteps = [
  {
    phase: "Consultation",
    items: ["Initial meeting", "Fit review", "Tax return analysis"],
  },
  {
    phase: "Strategy Session",
    items: ["Discovery", "Proposal", "Return review", "Service scope", "Engagement letter"],
  },
  {
    phase: "Engagement Letter",
    items: ["Engagement signed", "Payment processed"],
  },
  {
    phase: "Document Request",
    items: ["Request list", "Questionnaire", "Client expectations"],
  },
  {
    phase: "Onboarding",
    items: ["Bookkeeping setup", "Payroll coordination", "Implementation tasks"],
  },
];

export const roadmapStages = [
  {
    period: "First 30 Days",
    items: ["Initial meeting", "Tax return review", "Compliance and planning session", "Confirm scope"],
  },
  {
    period: "31-90 Days",
    items: [
      "Review entity structure",
      "Implement bookkeeping cleanup",
      "Coordinate payroll records",
      "Review reasonable compensation",
      "Review cash flow planning",
    ],
  },
  {
    period: "91-180 Days",
    items: [
      "Retirement plan review",
      "Accountable plan review",
      "Fringe benefit review",
      "Medical expense planning review",
    ],
  },
  {
    period: "181-270 Days",
    items: ["Ongoing strategy implementation", "Advanced strategy review"],
  },
  {
    period: "271-365 Days",
    items: [
      "Ongoing strategy implementation",
      "Advanced strategy review",
      "Assess next-year planning topics",
    ],
  },
];
