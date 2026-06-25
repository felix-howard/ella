/**
 * Public About page content for Ella Tax Services.
 */
export const companyFacts = [
  { label: "Legal name", value: "Ella Tax Services LLC" },
  { label: "Office", value: "10700 Richmond Ave Ste 117, Houston, TX 77042" },
  { label: "Phone", value: "(878) 678 0999" },
  { label: "Email", value: "contact@ella.tax" },
] as const;

export const serviceHighlights = [
  {
    title: "Tax resolution",
    description:
      "IRS and state notice support with document review, deadline tracking, and response next steps.",
    audience: "Resolution support",
    bullets: ["IRS and state notices", "Balance and penalty review", "Response preparation"],
  },
  {
    title: "Audit detection",
    description:
      "Return support review, audit-ready record organization, and advisor coordination for tax agency questions.",
    audience: "Protection support",
    bullets: ["Return support review", "Record organization", "Advisor coordination"],
  },
  {
    title: "Compliance",
    description:
      "Support for tax preparation, books, payroll coordination, sales tax, franchise tax, and filing deadlines.",
    audience: "Filing and records",
    bullets: ["Tax preparation", "Payroll coordination", "Sales and franchise tax"],
  },
] as const;

export const howWeWorkSteps = [
  {
    title: "Start online",
    description:
      "Begin with the path that fits your tax resolution, audit detection, compliance, or filing need.",
  },
  {
    title: "Organize records",
    description:
      "Upload documents through a secure online process and receive follow-up when records or answers are missing.",
  },
  {
    title: "Advisor review",
    description:
      "Our team reviews your facts, asks clarifying questions, and prepares the next filing or advisory step.",
  },
  {
    title: "File and follow up",
    description:
      "We help complete the filing, compliance, audit-support, or notice response work and keep support available after.",
  },
] as const;

export { homeAdvisors as advisors } from "./home-page-content";

export const values = [
  {
    label: "Clarity",
    description: "Clients should know what is needed, what is missing, and what happens next.",
  },
  {
    label: "Compliance",
    description: "Service recommendations depend on facts, records, deadlines, and signed engagement scope.",
  },
  {
    label: "Responsiveness",
    description: "Tax questions move faster when records, messages, and next steps are organized.",
  },
  {
    label: "Year-round support",
    description: "Tax service should support resolution, audit readiness, and compliance decisions outside filing season.",
  },
] as const;

export const aboutFaq = [
  {
    question: "Where is Ella Tax Services located?",
    answer:
      "Ella Tax Services LLC is based at 10700 Richmond Ave Ste 117, Houston, TX 77042 and serves clients through online tax service.",
  },
  {
    question: "Can I work with Ella Tax Services without visiting the office?",
    answer:
      "Yes. The service is built for online tax resolution, audit detection, compliance, secure document sharing, calls, email, filing, and advisor-supported follow-up.",
  },
  {
    question: "What services does Ella Tax Services provide?",
    answer:
      "Ella Tax Services focuses on tax resolution, audit detection, and compliance, with support for individual tax prep, business tax prep, advisory, bookkeeping cleanup, payroll coordination, sales tax, franchise tax, notices, and business advisory.",
  },
] as const;

export const socialLinks = [
  {
    label: "Facebook",
    href: "https://www.facebook.com/my.ella.tax/",
    iconPath:
      "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
  },
] as const;
