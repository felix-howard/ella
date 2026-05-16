# Login Compliance Gate Phase 03

**Date**: 2026-05-15 11:58
**Severity**: Medium
**Component**: Workspace login compliance gate
**Status**: Resolved

## What Happened

Phase 03 finished the post-login compliance gate for contractor agents. The workspace now runs a root `ComplianceGate`, checks Terms first, then checks contractor-agreement status, and only blocks contractor staff when the agreement is still missing. Non-contractors are not blocked. Signed users now see the correct modal ordering, fail-closed status handling, and a status refresh after signing or error recovery.

## The Brutal Truth

The ugly part was the sequencing. This looked like one auth problem, but it was really two different gates that had to stay strictly ordered or the whole thing got flaky fast. Any optimistic render here would have been wrong. The only safe move was to make the gate explicit, fail closed, and stop pretending the status would always be ready on first paint.

## Technical Details

Implemented in:
- `apps/workspace/src/main.tsx`
- `apps/workspace/src/components/terms/compliance-gate.tsx`
- `apps/workspace/src/components/contractor-agreements/contractor-agreement-gate.tsx`
- `apps/workspace/src/components/contractor-agreements/contractor-agreement-modal.tsx`
- `apps/workspace/src/components/contractor-agreements/use-contractor-agreements.ts`

Review fixes landed during the final pass:
- Terms-first ordering kept the contractor modal from racing the existing terms modal.
- Status queries now require auth and fail closed on errors.
- Contractor status refresh now runs after both signing and failure paths, so stale state does not leak through.

Validation passed:
- `pnpm -F @ella/workspace type-check`
- `pnpm -F @ella/workspace test` (`5 files / 23 tests`)
- code review second pass: no blocking issues

## What We Tried

We first treated the gate like a single reusable login wrapper. That was too coarse. We also considered letting the app render while status queries settled, but that would have exposed the workspace before compliance state was known. Both approaches were rejected because they created bypass risk.

## Root Cause Analysis

The root mistake was conflating login access with compliance state. Once contractor agreement enforcement was added, the old gate model was no longer enough. The system needed separate checks, strict ordering, and explicit refresh behavior instead of a single boolean “ready” path.

## Lessons Learned

Do not merge unrelated compliance checks into one implicit gate.
Fail closed when status is unknown.
Refresh status after state-changing actions instead of trusting cached data.

## Next Steps

Phase 05 still needs focused UI test coverage for the gate branches: loading, signed-out, fail-closed, contractor-missing, and accept-success. Owner: Phase 05 test pass. Target: before rollout docs and validation closeout.
