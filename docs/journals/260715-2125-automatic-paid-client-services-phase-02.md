---
date: "2026-07-15 21:25 Asia/Saigon"
session: "automatic-paid-client-services-phase-02"
branch: "feature/260714-next-work"
plan: "plans/260715-1929-GH-260714-automatic-paid-client-services/plan.md"
phase: 2
status: completed
---

# Journal: 2026-07-15 — Automatic Paid Client Services Phase 2

## Context

Phase 2 replaced indirect Stripe-session matching with deterministic quote provenance and completed the destructive schema cleanup prepared by Phase 1. The change applies only to future settled quote payments; historical financial rows remain untouched.

## What Happened

- Added nullable, indexed `Payment.paymentQuoteId` → `PaymentQuote` with `onDelete: SetNull`.
- Persisted the server-loaded quote id for future first and recurring settled quote payments; deposits and historical payments remain null.
- Added fail-closed quote/client/lead organization checks before payment insertion.
- Preserved prior migration history and historical `CLIENT_SERVICE_LOG` activity identifiers while removing the current manual service-log model and enums.
- Reviewed destructive SQL and applied migration `20260715135724_link_payments_remove_client_service_log` after explicit approval; 2 disposable legacy rows, the table, and two enums were removed.
- Prisma validation/generation, API type-check, migration status, and 26/26 targeted tests passed. Final adversarial review scored 9.8/10.

## Reflection

The nullable direct relation gives future paid-services work a trustworthy join without guessing from Stripe identifiers or rewriting history. Separating runtime retirement from destructive cleanup made approval explicit and kept the data-loss boundary small and reviewable.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep provenance server-controlled | Public callers must not attach payments to arbitrary quotes | Tenant scope remains authoritative and mismatches fail closed |
| Leave deposits and historical payments null | They are not eligible quote services, and backfill would require unsafe heuristics | Paid Services will intentionally show new qualifying data only |
| Use `onDelete: SetNull` | Financial history must survive quote deletion | Payment rows remain durable even if provenance is later removed |
| Preserve old migrations and activity identifiers | Applied history and stored audit rows are immutable facts | Current schema is clean while historical timelines remain readable |

## Next Steps

- Execute Phase 3 to synchronize full refunds and recurring billing lifecycle state through the new payment-to-quote relation.
- Keep production migration/deploy sequencing as an explicit rollout step.
