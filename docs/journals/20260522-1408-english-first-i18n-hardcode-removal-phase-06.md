# English-First i18n Hardcode Removal - Phase 06

Date: 2026-05-22

## Summary
- Completed final workspace hardcode cleanup for agreement expiry, data entry, uploads, verification, reupload copy, terms language switching, and Schedule C/E SMS template catalog handling.
- Hardened `scripts/i18n-audit.mjs` to fail on active Vietnamese hardcode, disallowed Vietnamese fallback patterns, and escaped Unicode Vietnamese literals.
- Kept explicit bilingual catalogs allowlisted and visible in audit output: locale files, terms legal text, SMS catalogs, DB seed labels, AI prompts, domain label maps, and filename transliteration.
- Updated code standards, system architecture, changelog, roadmap, and plan status.

## Validation
- `pnpm i18n:audit` pass: 0 active findings, 0 fallback findings.
- `pnpm type-check` pass across 8 packages.
- `pnpm -F @ella/workspace test` pass, 16 files / 56 tests.
- `pnpm -F @ella/api test` pass, 111 files / 2422 tests.
- `pnpm lint` pass with existing warnings only.

## Notes
- API test updates were test-contract drift after Phase 05 English-first runtime behavior and scoped Schedule C route access changes.
- Code review flagged escaped Unicode bypass risk; audit now decodes Unicode escapes before scanning.

## Unresolved Questions
- None.
