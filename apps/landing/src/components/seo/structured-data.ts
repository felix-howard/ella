/**
 * Helpers to generate JSON-LD structured data for rich search results.
 * Reference: https://schema.org
 */
import { siteConfig } from "@/config/site";
import { serviceNames } from "@/config/company-services";

const addressSchema = {
  "@type": "PostalAddress",
  streetAddress: siteConfig.contact.address.streetAddress,
  addressLocality: siteConfig.contact.address.addressLocality,
  addressRegion: siteConfig.contact.address.addressRegion,
  postalCode: siteConfig.contact.address.postalCode,
  addressCountry: siteConfig.contact.address.addressCountry,
};

/** Organization schema - tells Google about the legal business */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: siteConfig.organization.name,
    legalName: siteConfig.organization.legalName,
    url: siteConfig.url,
    logo: `${siteConfig.url}${siteConfig.organization.logo}`,
    email: siteConfig.contact.email,
    telephone: siteConfig.contact.phone,
    address: addressSchema,
    ...(siteConfig.organization.sameAs.length > 0 && {
      sameAs: siteConfig.organization.sameAs,
    }),
  };
}

/** WebSite schema - enables sitelinks search box in Google */
export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: siteConfig.name,
    url: siteConfig.url,
  };
}

/** ProfessionalService schema - describes public tax services */
export function professionalServiceSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: siteConfig.name,
    description: siteConfig.description,
    url: siteConfig.url,
    image: `${siteConfig.url}${siteConfig.ogImage}`,
    telephone: siteConfig.contact.phone,
    email: siteConfig.contact.email,
    address: addressSchema,
    areaServed: {
      "@type": "Country",
      name: "United States",
    },
    serviceType: serviceNames,
    sameAs: siteConfig.organization.sameAs,
  };
}

/** Service list schema - describes the public service catalog */
export function serviceListSchema(
  items: readonly { title: string; description: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Ella Tax Services service catalog",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "Service",
        name: item.title,
        description: item.description,
        provider: {
          "@type": "ProfessionalService",
          name: siteConfig.name,
          url: siteConfig.url,
        },
      },
    })),
  };
}

/** FAQ schema - for FAQ sections, generates rich results */
export function faqSchema(
  items: readonly { question: string; answer: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

/** BreadcrumbList schema - for navigation breadcrumbs */
export function breadcrumbSchema(
  items: { name: string; url: string }[]
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
