/**
 * Central site configuration for SEO, meta tags, and structured data.
 * Update these values for production deployment.
 */
export const siteConfig = {
  name: "Ella",
  description:
    "Ella streamlines tax preparation with AI-powered document management, automated classification, and seamless team collaboration. Collect, organize, and process tax documents faster.",
  url: "https://ella.tax",
  ogImage: "/og-default.png",
  locale: "en_US",
  themeColor: "#10B981",

  // Social / contact
  twitter: "@ella_tax",
  linkedIn: "", // Add LinkedIn profile URL when available
  formspreeId: "YOUR_FORMSPREE_ID", // Replace with real Formspree form ID

  // Structured data - Organization
  organization: {
    name: "Ella",
    logo: "/logo.svg",
    sameAs: [] as string[], // Add social profile URLs
  },
} as const;

export type SiteConfig = typeof siteConfig;
