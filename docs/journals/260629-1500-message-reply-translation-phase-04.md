---
date: 2026-06-29
topic: "Message reply translation phase 04"
plan: "plans/260628-2351-GH-260628-message-reply-translation/plan.md"
phase: "phase-04-show-english-and-validation"
---

# Message Reply Translation Phase 04

## Context

Final phase for staff-side EN -> VI reply translation.
Earlier phases added schema, API contracts, translation persistence, and composer UX.
Phase 04 closed the visible history loop: staff can see Vietnamese sent SMS and reveal the private English source later.

## What Changed

- Added outbound translated SMS `Show English` / `Hide English` source display.
- Kept source display separate from inbound AI translation panel.
- Added neutral source panel styling and mobile tap-friendly toggle.
- Added shared `isOutboundTranslatedSms()` guard.
- Conversation previews now use staff English only for full translated outbound SMS metadata.
- Partial metadata, non-SMS messages, inbound messages, and attachment-only messages keep existing preview behavior.
- Optimistic message merge now reconciles direct sends with server `translationEdited: false`, while preserving strict metadata matching for translated sends.
- Added regression tests for source display, preview selection, metadata boundaries, and optimistic merge.
- Updated plan, changelog, codebase summary, unified inbox docs, and architecture notes.

## Validation

- `pnpm -F @ella/workspace test -- message-bubble conversation-list quick-actions-bar reply-translation optimistic-message-merge` passed, 28 tests.
- `pnpm -F @ella/workspace type-check` passed.
- `pnpm -F @ella/api test -- message-reply-translation message-translation` passed, 19 tests.
- `pnpm -F @ella/api type-check` passed.
- `pnpm i18n:check` passed.
- `git diff --check` passed.
- `pnpm -F @ella/workspace lint` passed with 14 pre-existing warnings, 0 errors.
- Code review re-check: 9/10, 0 critical, 0 warnings.

## Decisions

- Source reveal requires full translated SMS metadata: outbound, SMS, VI content, EN staff source, non-empty source.
- Direct and partial metadata must not surface source UI or English preview.
- Browser QA remains manual because it needs authenticated Workspace/API plus Gemini/Twilio configuration.
- No commit made; git-manager reported commit readiness only.

## Follow-Up

- Run authenticated browser smoke before production rollout:
  Direct send, EN -> VI preview/edit/send, `Show English`, conversation preview, inbound translate, Gemini unavailable fallback.
- Verify generated/local `apps/landing/.astro/settings.json` before any commit.

## Unresolved Questions

- None.
