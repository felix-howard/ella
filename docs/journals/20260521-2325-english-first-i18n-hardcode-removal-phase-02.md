# English-First i18n Hardcode Removal - Phase 02

## Summary
- Completed portal English-first migration.
- Removed legacy `UI_TEXT` runtime copy from portal i18n config.
- Mapped portal/expense/rental API display errors through stable codes and locale keys.
- Localized expense/rental submit and autosave fallbacks, error boundaries, expense validation labels, and missing-document labels.

## Validation
- `pnpm -F @ella/portal type-check` pass.
- Targeted portal ESLint pass.
- `pnpm i18n:audit | rg '^apps/portal/src'` clean.
- `pnpm i18n:audit` portal locale parity pass.

## Notes
- Repo-wide audit still reports non-portal hardcode for later phases.
- API endpoint Vietnamese payload cleanup remains scoped to Phase 05.

## Unresolved Questions
- None.
