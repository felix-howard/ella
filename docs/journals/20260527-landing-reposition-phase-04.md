# Landing Reposition Phase 04

Date: 2026-05-27

## Summary
- Completed `/about`, `/why-ella`, and `/tax-advisory` repositioning for Ella Tax Services LLC.
- Public pages now read as online tax services content, not SaaS/product marketing.
- `/tax-advisory` remains a noindex static preview with nonsensitive planning content and explicit warning that the preview gate is not for confidential taxpayer information.

## Changed
- Rebuilt About with company facts, service highlights, digital-first service process, advisor cards, values, FAQ schema, and contact CTA.
- Rebuilt Why Ella with client problems, Ella approach, qualitative comparison table, trust strip, FAQ schema, and contact CTA.
- Cleaned tax advisory copy: removed internal process terms, vendor references, example taxpayer data, and specific example savings.
- Fixed advisory estimated-tax table accessibility and removed blank note cells.
- Removed whole-card hover affordance from shared service cards so only CTA links feel interactive.

## Validation
- `pnpm -F @ella/landing type-check` pass
- `pnpm -F @ella/landing lint` pass
- `pnpm -F @ella/landing build` pass
- Targeted old/internal phrase audit pass
- Tester validation pass
- Follow-up code review pass

## Notes
- Existing Astro type-check hints remain in pricing calculator service buttons and are outside Phase 04.
- Static preview gate is not real access control; use server/edge auth if future advisory content becomes confidential.

## Unresolved Questions
- Should `/tax-advisory` become public, stay noindex preview, or move behind real access control?
