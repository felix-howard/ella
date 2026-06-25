---
date: "2026-06-25"
topic: "Agreement Draft Collaboration Phase 5"
branch: "feature/next-task-8"
plan: "plans/260625-1033-agreement-draft-collaboration/plan.md"
---

# Agreement Draft Calculator Handoff

## Context

Phase 5 moved the pricing calculator Engagement Letter flow onto shared Agreement drafts.

## What Happened

- Calculator Engagement Letter content now seeds `AgreementDraftEditor` as `source="CALCULATOR"`.
- Calculator source snapshots are intentionally minimal: `preparedAt`, recipient id/type, setup total, monthly total, and tier label.
- Existing calculator drafts trigger explicit `Resume saved calculator draft` vs `Start from current quote`.
- Manual drafts no longer block the calculator flow.
- Calculator sends are draft-first: first save creates the draft only, then preview/send finalizes the saved draft.

## Decisions

- Saved draft content stays source of truth; new quote values never merge into an existing calculator draft silently.
- Modal freezes the entry-time calculator draft decision so first-save refetch cannot swap the editor into the resume/start choice.
- Resumed drafts with `sourceSnapshot: null` keep that null state rather than inheriting the current quote snapshot.

## Validation

- `pnpm -F @ella/workspace type-check`
- `pnpm -F @ella/workspace test -- calculator-engagement-letter`
- `pnpm -F @ella/workspace test -- pricing-engagement-letter-panel`
- `pnpm -F @ella/workspace test -- agreement-editor-actions`
- `pnpm i18n:check`

## Next

Phase 6 remains: tests, docs, and final validation across the full Agreement draft collaboration plan.

## Unresolved Questions

None.
