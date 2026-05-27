/**
 * Central business configuration for SEO, contact paths, and structured data.
 */
export const siteConfig = {
  name: "Ella Tax Services",
  legalName: "Ella Tax Services LLC",
  description:
    "Online tax preparation, advisory, bookkeeping, and compliance support for individuals, families, and small businesses.",
  url: "https://ella.tax",
  ogImage: "/og-default.png",
  locale: "en_US",
  themeColor: "#0EA5E9",

  contact: {
    phone: "(878) 678 0999",
    phoneHref: "tel:+18786780999",
    email: "contact@ella.tax",
    emailHref: "mailto:contact@ella.tax",
    address: {
      streetAddress: "10700 Richmond Ave Ste 117",
      addressLocality: "Houston",
      addressRegion: "TX",
      postalCode: "77042",
      addressCountry: "US",
    },
    seniorAccountRepresentative: "Ella Tax Services client support",
    seniorAccountAdvisor: "Ella Tax Services advisory team",
  },

  cta: {
    primaryLabel: "Start Online Tax Filing",
    secondaryLabel: "Book Consultation",
    contactLabel: "Contact Ella Tax Services",
    navLabel: "Get Started",
    primaryHref: "/get-started",
    secondaryHref: "https://www.facebook.com/my.ella.tax/",
  },

  facebook: "https://www.facebook.com/my.ella.tax/" as string,
  linkedIn: "" as string, // Add LinkedIn profile URL when available
  twitter: "" as string, // Add Twitter/X handle when available
  formspreeId: "YOUR_FORMSPREE_ID", // Replace with real Formspree form ID

  organization: {
    name: "Ella Tax Services",
    legalName: "Ella Tax Services LLC",
    logo: "/ella-logo.png",
    sameAs: ["https://www.facebook.com/my.ella.tax/"] as string[],
  },
} as const;

export type SiteConfig = typeof siteConfig;
