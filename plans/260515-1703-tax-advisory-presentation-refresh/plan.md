# Tax Advisory Presentation Refresh

Status: complete
Progress: 100%

## Context
- Source deck: `/Users/felix/Downloads/ella.tax company presentation.md`
- Target page: `apps/landing/src/pages/tax-advisory.astro`
- Main content config: `apps/landing/src/config/tax-advisory-presentation.ts`

## Phases
1. [complete] [Refresh page content and sections](phase-01-refresh-tax-advisory-page.md)

## Key Dependencies
- Keep existing password-gated private preview behavior.
- Keep `/tax-advisory` as a noindex landing page.
- Preserve Astro/Tailwind patterns in `apps/landing`.

## Validation
- `pnpm -F @ella/landing type-check` pass
- `pnpm -F @ella/landing build` pass
- `pnpm -F @ella/landing lint` pass

## Unresolved Questions
- None.
