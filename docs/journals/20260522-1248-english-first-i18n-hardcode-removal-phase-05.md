# Phase 05 Journal - Backend English-First i18n Hardcode Removal

Date: 2026-05-22

## Summary
- Completed backend English-first migration for Phase 05.
- Runtime backend copy now defaults to English while explicit Vietnamese SMS and bilingual catalog data remain supported.
- Fixed Schedule C/E staff route scoping during review follow-up.

## Changes
- Converted portal upload, public expense/rental, staff Schedule C/E, auth, OCR/action, SMS webhook, voicemail, scheduler, and AI pipeline copy to English-first.
- Added backend label/language helpers and English document/status/action labels.
- Kept Vietnamese catalog entries in explicit allowlist buckets.
- Changed SMS template fallback, org SMS language fallback, and upload-link template fallback to `EN`.
- Updated classifier label helper to default English and support explicit `VI`.
- Preserved portal compatibility fields for `labelVi`, `statusVi`, and `reasonVi`.

## Validation
- `pnpm -F @ella/api type-check` pass
- `pnpm -F @ella/shared type-check` pass
- `pnpm --filter @ella/api test -- src/services/sms src/services/ai/__tests__/document-classifier.test.ts` pass, 9 files / 86 tests
- `pnpm i18n:audit` pass
- Tester subagent: Phase 05 validation pass, workspace residual findings only
- Code reviewer focused re-review: no blockers

## Follow-Up
- Phase 06 should clear remaining workspace audit findings and decide whether scan mode should fail on active findings.

## Unresolved Questions
- None.
