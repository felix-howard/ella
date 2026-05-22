# English-First I18n Hardcode Removal Phase 01

**Date**: 2026-05-21 22:46
**Severity**: Medium
**Component**: Portal i18n baseline, language persistence, workspace locale parity
**Status**: Resolved

## What Happened

Phase 01 finished the baseline audit and guard cleanup for English-first i18n. The portal now defaults to English cleanly, the language detector no longer auto-caches fallback English into `localStorage`, explicit language changes still write `ella-language`, and VI sync stays intact when there is no manual override. Portal API client fallback, network, and status errors are English-first. Workspace locale parity was patched for missing danger zone keys and plural group page count keys. We also added `scripts/i18n-audit.mjs` plus `i18n:audit`, `i18n:check`, and `i18n:scan`.

## The Brutal Truth

This was tedious and necessary. The codebase had too many places where English text was treated like a casual fallback instead of the contract. That leaks through as inconsistent UX and makes future localization work miserable because nobody can tell whether a string is real content or a forgotten hardcode.

## Technical Details

Validation passed:
- `pnpm i18n:audit`
- `pnpm -F @ella/portal type-check`
- `pnpm -F @ella/workspace type-check`

Audit inventory:
- 1330 active findings in 112 files
- 2008 allowlisted findings in 126 files

The detector change is the important contract fix: fallback English is no longer cached automatically, but deliberate language toggles still persist `ella-language`. That keeps client preference sync working for VI without overwriting user intent.

## What We Tried

- Kept fallback caching in place and relied on it for sync. That was wrong because it silently converted default behavior into stored preference.
- Treated the audit as a passive report. That was useless until the guard inventory was backed by a real scan script and repeatable checks.
- Let review flag the contract gap first. The blocker was real, and the fix had to land before calling this done.

## Root Cause Analysis

The root cause was uncontrolled fallback behavior spread across the portal and workspace instead of a single language contract. English was drifting in as an implementation detail, not an explicit default.

## Lessons Learned

If fallback text can be cached, it becomes state. State needs a policy. Also, localization audits are noise unless they are paired with a repeatable scan and a clear override contract.

## Next Steps

Phase 01 is done. The next pass should target the remaining active findings and add portal regression coverage for the language override contract, since that is still the weakest point.

## Unresolved Questions

- Which portal flows still need direct regression tests around manual language override vs detector fallback?
