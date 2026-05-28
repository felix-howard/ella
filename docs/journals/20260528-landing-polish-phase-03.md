# Landing Polish Phase 03

**Date**: 2026-05-28 14:10
**Severity**: Low
**Component**: Landing conversion pages
**Status**: Resolved

## What Happened

Completed Phase 03 of landing polish. High-intent conversion pages now have clearer service grouping, safer first-contact presentation, more polished pricing surfaces, and a wired consultation flow.

## Technical Details

- Grouped `/services` into service families and separated online support into a capability path.
- Polished `/get-started` safe-contact, contact details, inquiry cards, and registration panel.
- Polished `/pricing` preview gate, hero CTAs, tier cards, one-time services, calculator shell, form controls, and summary panel.
- Mounted `ConsultationModal` on pricing and wired summary-panel buttons through `calc:open-consultation`.
- Passed `submitHref=""` to the modal contact form so it uses contact submission instead of default registration redirect.
- Extracted shared contact form browser behavior into `apps/landing/src/scripts/contact-form.ts`.

## Validation

- `pnpm -F @ella/landing type-check` pass, 0 errors/warnings/hints
- `pnpm -F @ella/landing lint` pass
- `pnpm -F @ella/landing build` pass, 11 pages built and sitemap generated
- `pnpm -F @ella/landing exec tsc --noEmit -p tsconfig.json` pass
- Local route smoke check pass for `/services`, `/get-started`, `/pricing`
- Tester and code review follow-up pass for pricing consultation flow

## Next Steps

Continue with Phase 04 private/legal/redirect route polish.

## Unresolved Questions

- None.
