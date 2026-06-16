# Customizable Registration Headers Phase 04: Portal Rendering

**Date**: 2026-06-16 14:44 Asia/Saigon  
**Severity**: Medium  
**Component**: `apps/portal` registration routes, header resolver, shared page header component  
**Status**: Resolved

## What Happened

Phase 04 wired the customizable registration header behavior into the portal. The portal API types now carry org registration header fields and the campaign header validation response. We added a pure resolver for `DEFAULT` / `CUSTOM` / `HIDDEN`, introduced a shared `RegistrationPageHeader` component, and rendered resolved headers in both base and campaign registration routes. Campaign intro still stays above the title block. The hook also carries campaign header state and now guards against stale route-param data with a settled page key.

## The Brutal Truth

This looked like a clean frontend pass, but stale route state would have made the whole feature flaky fast. The annoying part is that the UI was not just "displaying text"; it was deciding which source of truth to trust, and that is exactly where broken registration flows get embarrassing.

## Technical Details

- Portal types now include org header fields and campaign header validation response.
- Added pure header resolver for `DEFAULT`, `CUSTOM`, `HIDDEN` org/campaign behavior.
- Added shared `RegistrationPageHeader` component.
- Base and campaign registration routes now render resolved headers.
- Campaign intro remains above the title block.
- Hook tracks campaign header state and blocks stale route-param bleed through a settled page key.

Validation passed:
- `pnpm -F @ella/portal type-check`
- `git diff --check`
- tester pass after stale-state fix
- reviewer pass after stale-state fix
- UI review pass after stale-state fix

Manual browser URL verification was not run. That is still the weak spot here.

## What We Tried

- Kept header resolution pure so org and campaign behavior stayed testable.
- Reused one shared header component instead of duplicating route-specific markup.
- Added the settled page key guard only after stale state showed up, because without it the route param updates could race the rendered campaign state.

## Root Cause Analysis

The bug came from trusting route-param driven state too early. The page could briefly render against stale campaign data, which is fine until it is not, and for registration headers it is not. The settled page key fix was the actual correction, not the pretty UI work.

## Lessons Learned

- Do not let route params outrun settled page state when the UI has multiple header sources.
- Pure resolvers pay off because they make `DEFAULT` / `CUSTOM` / `HIDDEN` behavior obvious and reviewable.
- UI review is not enough here; browser-level verification still matters.

## Next Steps

Phase 05 should cover manual QA in browser and catch any route-specific header regressions before this ships wider.

Unresolved questions: should manual browser verification stay in Phase 05 only, or get added as a required gate for all registration header UI changes?
