# Landing Reposition Phase 03 Journal

Date: 2026-05-27

## Scope
- Completed Phase 03 home + services redesign.
- Home now leads with online tax filing and business tax support from Ella Tax Services.
- `/services` now canonical service catalog.
- `/features` now redirects to `/services` through Vercel 301 config, with Astro static fallback.

## Changes
- Replaced SaaS/product-led home content with service-led sections: hero, trust strip, service overview, process, audience, advisors, FAQ, contact CTA.
- Added typed content config for home and services pages.
- Services page covers individual tax, business tax, planning/advisory, bookkeeping/cleanup, payroll, sales/franchise tax, notices, and entity/business advisory.
- Added ProfessionalService, FAQ, breadcrumb, and service list schema coverage.
- Hardened JSON-LD escaping in shared SEO head.
- Replaced comparison div grid with semantic table.
- Added per-card CTA accessible names.

## Validation
- `pnpm -F @ella/landing type-check` passed.
- `pnpm -F @ella/landing lint` passed.
- `pnpm -F @ella/landing build` passed.
- Targeted old-positioning audit passed.
- Tester validation passed.
- Code review passed after fixes.

## Notes
- Unrelated Astro checker hints remain in pricing calculator inline handlers.
- Docs manager assessed docs impact as minor and made no doc edits; existing docs already reflect reposition.

## Unresolved Questions
- Public copy language: English only, Vietnamese support, or bilingual?
- `/pricing`: public, password-gated, or removed from nav?
- Contact CTA destination: backend/Formspree, email, phone, or Facebook for v1?
