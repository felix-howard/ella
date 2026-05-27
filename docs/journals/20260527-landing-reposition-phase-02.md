# 2026-05-27 Landing Reposition Phase 02

## Summary
- Completed shared design system for Ella Tax Services landing reposition.
- Added service-first Astro primitives for hero, service cards, process, trust, advisors, contact bands, and FAQs.
- Updated shared tokens, fonts, CTAs, contact form behavior, stats fallback, FAQ schema safety, and animation no-JS fallback.

## Validation
- `pnpm -F @ella/landing type-check` pass
- `pnpm -F @ella/landing lint` pass
- `pnpm -F @ella/landing build` pass

## Notes
- Phase 03 should rewrite home/services with these primitives and remove legacy screenshot/showcase globals.
- `apps/landing/src/config/company-services.ts` remains required for the shared contact form service select.

## Unresolved Questions
- Final visual asset source still open: generated images, licensed sourced images, or existing brand assets.
