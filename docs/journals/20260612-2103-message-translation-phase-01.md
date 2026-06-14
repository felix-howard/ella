# Message Translation Phase 01

**Date**: 2026-06-12 21:03 Asia/Saigon  
**Severity**: Medium  
**Component**: org-scoped case message translation, workspace messaging UI  
**Status**: Resolved

## What Happened

Phase 01 shipped org-scoped case message translation end to end: a `POST /messages/:messageId/translate` service path, staff-scoped rate limiting, transient workspace bubble UI for translated state, and Vietnamese detection plus eligibility gating so the translate action only appears when the message is actually likely translatable. Docs and tests were updated alongside the code.

## The Brutal Truth

The fragile part was not the endpoint. It was the detection and eligibility path: if that logic is loose, the UI lies and staff waste time clicking a dead affordance. This was annoying to tighten, but better than shipping a translation button that looks smart and behaves dumb.

## Technical Details

Validation:
- `pnpm -F @ella/api type-check` pass
- `pnpm -F @ella/workspace type-check` pass
- `pnpm -F @ella/api test -- messages` pass, 5 files / 34 tests
- `pnpm -F @ella/workspace test -- message-language-detection message-translation-eligibility` pass, 2 files / 6 tests
- `pnpm i18n:check` pass
- `git diff --check` pass

Review:
- Initial code review flagged issues.
- Those concerns were fixed.
- Re-review came back clean.

## What We Tried

- Tightened org scoping on the translation service instead of letting it act on message IDs alone.
- Added staff rate limiting to protect the Gemini-backed translate flow.
- Kept the UI bubble transient so translation feedback does not pollute the thread.
- Refined Vietnamese detection and eligibility so the action is shown only when useful.

## Root Cause Analysis

The real risk was overtrusting message text heuristics and UI state. Translation features fail quietly when eligibility is fuzzy, and that turns into wasted clicks and noisy support cases. The endpoint was the easy part; correctness lived in the gating.

## Lessons Learned

If a feature depends on language detection, test the detection first and the button second. Also, org-scoping and rate limiting are not optional extras on AI-backed endpoints; they are the guardrails that keep quota and tenant boundaries intact.

## Next Steps

- Manual browser QA still needs to happen in an interactive session.
- Gemini must be configured with an API key before real translation traffic can run.

