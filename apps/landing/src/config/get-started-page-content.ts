export const getStartedProcess = [
  {
    title: "Tell us what you need",
    description:
      "Send a brief inquiry with your contact information, client type, tax issue, service need, and timing.",
  },
  {
    title: "Ella confirms scope",
    description:
      "We review the request, confirm the right service path, and explain the next documents needed.",
  },
  {
    title: "Use secure onboarding",
    description:
      "After engagement, tax documents and sensitive information move through the secure client workflow.",
  },
  {
    title: "Advisor prepares and reviews",
    description:
      "Your advisor prepares the work, follows up on open items, and reviews the filing or service outcome.",
  },
] as const;

export const inquiryCards = [
  {
    title: "What to include",
    items: [
      "Service you need",
      "Tax resolution, audit detection, or compliance concern",
      "Tax year or deadline",
      "Individual, family, or business context",
      "Best phone and email",
    ],
  },
  {
    title: "What not to include",
    items: [
      "Social Security numbers",
      "Tax ID numbers",
      "Income documents",
      "Bank account information",
    ],
  },
  {
    title: "Helpful next steps",
    items: [
      "Book a consultation",
      "Prepare prior-year returns",
      "Gather IRS or state notices",
      "List audit or compliance deadlines",
      "List bookkeeping cleanup needs",
    ],
  },
] as const;

export const getStartedFaqItems = [
  {
    question: "Can I start online if I am not in Houston?",
    answer:
      "Yes. Ella Tax Services supports online tax resolution, audit detection, compliance, and filing workflows. We confirm state-specific needs before starting work.",
  },
  {
    question: "Should I upload tax documents through this page?",
    answer:
      "No. This public inquiry page is only for basic contact and service details. Sensitive tax documents should be shared only after Ella provides secure onboarding.",
  },
  {
    question: "How quickly will Ella Tax Services respond?",
    answer:
      "Response timing depends on volume and filing season, but the team uses your inquiry details to route the request to the right next step.",
  },
] as const;
