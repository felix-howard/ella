# Individual Schedule C Activity

**Date**: 2026-05-11 18:38
**Severity**: Medium
**Component**: Workspace Schedule C tab
**Status**: Resolved

## What Happened

We shipped the Workspace Schedule C tab so the individual client now always sees their own send/manage panel first, even when linked businesses already have Schedule C forms. Linked business rows still render below, which keeps the context without burying the primary action. This was a UI flow fix only. No schema change, no API migration, no backend work.

## The Brutal Truth

The frustrating part is we had the right data and still showed the wrong priority. The individual flow was getting eclipsed by linked-business rows, which made the tab feel broken even though nothing was technically missing. We were optimizing around the presence of related records instead of the actual task the user came to do.

## Technical Details

Changed the client route and Schedule C tab rendering in:
- `apps/workspace/src/routes/clients/$clientId.tsx`
- `apps/workspace/src/components/cases/tabs/schedule-c-tab/individual-schedule-c-activities.tsx`
- `apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-activities.ts`
- `apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-business-summary-list.tsx`

Updated locale copy in:
- `apps/workspace/src/locales/en.json`
- `apps/workspace/src/locales/vi.json`

Tests added/updated in:
- `apps/workspace/src/components/cases/tabs/schedule-c-tab/individual-schedule-c-activities.test.tsx`
- `apps/workspace/src/components/cases/tabs/schedule-c-tab/schedule-c-activities.test.ts`

Validation passed:
- `pnpm -F @ella/workspace test -- schedule-c-activities.test.ts individual-schedule-c-activities.test.tsx` `5 tests`
- `pnpm -F @ella/workspace type-check`
- `pnpm -F @ella/workspace lint` with the existing `9` warnings only
- code-reviewer re-review: `DONE`, no blockers

## What We Tried

We first treated linked-business Schedule C rows as the main content because they were already present in the data. That was the wrong framing. The better fix was to render the individual client’s panel first and keep business rows secondary. We also confirmed this did not need a schema/API migration, because the bug was ordering and grouping, not missing data.

## Root Cause Analysis

The tab logic conflated “related Schedule C exists” with “related Schedule C should lead the screen.” That is a design bug, not a data bug. Once business forms existed, the individual CTA lost precedence and the UI no longer matched the workflow.

## Lessons Learned

Primary user action must stay first, even when secondary records exist.
Do not let related data reshuffle the main CTA unless the product spec says so.
Add regression coverage for render precedence, not just presence of data.

## Next Steps

No open implementation work. Keep the new Schedule C tests in place as the regression guard, and preserve this render order if the tab gets expanded later.
