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
    title: "Tax preparation",
    description:
      "Online individual and business tax filing with document review, organized requests, and clear filing steps.",
    audience: "Individuals and businesses",
    bullets: ["Individual returns", "Business returns", "Schedule C support"],
  },
  {
    title: "Planning and advisory",
    description:
      "Year-round tax planning conversations for income changes, entity questions, estimates, and business decisions.",
    audience: "Planning support",
    bullets: ["Tax projections", "Entity consultation", "Compliance review"],
  },
  {
    title: "Bookkeeping and cleanup",
    description:
      "Support for tax-ready books, cleanup work, payroll coordination, sales tax, franchise tax, and notice response.",
    audience: "Business records",
    bullets: ["Bookkeeping cleanup", "Payroll coordination", "Notice help"],
  },
] as const;

export const howWeWorkSteps = [
  {
    title: "Start online",
    description:
      "Begin with the service path that fits your tax situation and share basic details with Ella Tax Services.",
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
      "We help complete the filing, planning, bookkeeping, or notice response and keep support available after.",
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
    description: "Recommendations depend on the facts, records, deadlines, and signed engagement scope.",
  },
  {
    label: "Responsiveness",
    description: "Tax questions move faster when records, messages, and next steps are organized.",
  },
  {
    label: "Year-round support",
    description: "Tax service should support filing season and the decisions that happen outside filing season.",
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
      "Yes. The service is built for online tax filing, secure document sharing, calls, email, and advisor-supported follow-up.",
  },
  {
    question: "What services does Ella Tax Services provide?",
    answer:
      "Ella Tax Services supports individual tax prep, business tax prep, tax planning, advisory, bookkeeping, cleanup, payroll coordination, sales tax, franchise tax, notices, and business advisory.",
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
