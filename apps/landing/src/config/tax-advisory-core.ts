export const taxAdvisoryPasswordHash =
  "4654d793972c3b6a1d48fb0ab58d9cb0de46c3d33d605f9222c283dfaa12d420";
export const taxAdvisoryStorageKey = "ellaTaxAdvisoryAuth:1233";

export const heroMetrics = [
  { value: "14", label: "presentation sections" },
  { value: "365", label: "day implementation roadmap" },
  { value: "$53,953", label: "example tax savings" },
];

export const helpPromises = [
  "Make smarter tax decisions",
  "Maximize the tax strategies to provide the most benefit to you, the taxpayer",
  "Provide accountability to help realize tax savings through key implementation tasks",
  "Strategize to help increase revenue",
  "Strategize to help increase profit",
  "Keep an eye on potential tax burdens",
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
    title: "Lack of knowledge from tax professional.",
    description: "The professional does not identify the right strategies early enough.",
  },
  {
    title: "Lack of strategies",
    description: "The client does not receive a complete strategy plan.",
  },
  {
    title: "Number does not align with book record",
    description: "The return, books, payroll, and supporting records do not match.",
  },
  {
    title: "Audit and penalties",
    description: "Weak documentation can create audit exposure and penalties.",
  },
  {
    title: "Client hasn't done the necessary work",
    description: "A strategy cannot be claimed if the required work is not completed.",
  },
];

export const serviceDeliverables = [
  {
    title: "Tax return analysis",
    highlights: ["Compliance", "Find Saving"],
    description: "What Tax Strategies are clients qualified",
  },
  {
    title: "Tax Plan",
    highlights: ["Confidence"],
    description: "What firm and client agree on plan",
  },
  {
    title: "Tax Strategy Report",
    highlights: ["Certainty"],
    description: "Document every Strategy for Compliance",
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
  { id: "oltro", label: "Data enter Oltro", tone: "green" },
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
    items: ["Initial Meeting", "Faint Process", "Tax Return Analysis"],
  },
  {
    phase: "Strategy Session",
    items: ["Discovery", "Proposal", "Tax Return Analysis", "Pricing Calculator", "Engagement Letter"],
  },
  {
    phase: "Engagement Letter",
    items: ["Engagement Letter Signed", "Payment Processed"],
  },
  {
    phase: "Document Request",
    items: ["Request List", "Questionnaire", "Client Expectation"],
  },
  {
    phase: "Onboarding",
    items: ["Bookkeeping Onboard", "Payroll Onboard", "Implement Tasks"],
  },
];

export const roadmapStages = [
  {
    period: "First 30 Days",
    items: ["Initial Meeting", "Tax Return Review", "Compliance / Planning Session", "Confirm"],
  },
  {
    period: "31-90 Days",
    items: [
      "Implement Entity Optimization",
      "Implement Bookkeeping",
      "Implement Payroll",
      "Implement Reasonable Compensation",
      "Implement Cash Plan",
    ],
  },
  {
    period: "91-180 Days",
    items: [
      "Retirement Implement",
      "Implement Augusta Rule",
      "Fringe Benefit Implementation",
      "Medical Implementation",
    ],
  },
  {
    period: "181-270 Days",
    items: ["Ongoing Strategy Implementation", "Advance Strategy Implementation"],
  },
  {
    period: "271-365 Days",
    items: [
      "Ongoing Strategy Implementation",
      "Advance Strategy Implementation",
      "Assess New Strategy for Y2",
    ],
  },
];
