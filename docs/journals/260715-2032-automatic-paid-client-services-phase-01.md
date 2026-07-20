---
date: "2026-07-15 20:32 Asia/Saigon"
session: "automatic-paid-client-services-phase-01"
branch: "feature/260714-next-work"
plan: "plans/260715-1929-GH-260714-automatic-paid-client-services/plan.md"
phase: 1
status: completed
---

# Journal: 2026-07-15 — Automatic Paid Client Services Phase 1

## Context

Phase 1 retired the manual client service ledger from API and Workspace runtime surfaces while keeping the staff-visible Services route ready for the later paid-services projection. Prisma cleanup remained intentionally deferred to Phase 2.

## What Happened

- Removed manual service-log routes, schemas, API client contracts, mutations, forms, modals, timeline components, and obsolete EN/VI copy.
- Kept `?tab=services` valid for individual and business clients, including non-admin staff, with an accessible read-only placeholder.
- Preserved legacy activity action/target identifiers and added coverage proving historical service-log timeline entries still render.
- Confirmed retired endpoints return 404 and no runtime code references `ClientServiceLog`; Prisma schema and migration history were untouched.
- Final targeted validation passed: 53/53 tests, API and Workspace type-checks, clean diff check, and 10/10 code review.

## Reflection

Retiring application behavior before destructive schema work kept risk contained and made the phase mostly subtractive. The full i18n audit still reports 13 pre-existing findings in untouched files; Phase 1's changed EN/VI service keys remain aligned, so those findings are not a regression from this work.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep legacy service-log activity identifiers | Stored audit rows must remain understandable after emitters disappear | Historical activity stays readable without allowing new manual entries |
| Keep Services navigation with a neutral placeholder | Staff need a stable URL and Phase 5 replacement point | No manual controls or financial data are exposed during phased rollout |
| Leave Prisma objects unchanged | Destructive removal requires its own reviewed migration and explicit approval | Phase 2 owns schema cleanup and quote-payment provenance |

## Next Steps

- Execute Phase 2: add deterministic `Payment.paymentQuoteId` provenance, generate and review the forward migration, then request approval before applying destructive SQL.
