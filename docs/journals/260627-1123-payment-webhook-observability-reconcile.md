---
date: "2026-06-27"
plan: "260626-1945-GH-260625-payment-ledger-receipts-stripe-customer-polish"
phase: 5
topic: "Payment webhook observability and receipt reconcile"
---

# Payment Webhook Observability and Receipt Reconcile

## Context

Phase 5 added support tooling around Stripe payment receipt capture. Earlier phases stored receipt/customer fields and exposed them in the staff Payments tab; this phase made webhook delivery and missing receipt facts debuggable.

## What Happened

- Added a Stripe webhook event log service that records event id, type, Stripe object id, livemode, status, attempt count, and redacted failure summary.
- Updated the Stripe webhook route to claim event processing before running side effects.
- Terminal duplicate events now return `200` without re-running handlers.
- Fresh in-flight duplicates return `409`, so Stripe retries instead of treating an unfinished event as complete.
- Stale `processing` rows can be reclaimed via `updatedAt` lease without duplicate receive bookkeeping refreshing that lease.
- Added admin-only receipt reconcile endpoint for existing org/client-scoped `Payment` rows.
- Reconcile updates only Stripe receipt/customer fields and never mutates amount, status, or paid timestamp.

## Decisions

- Kept webhook logging lightweight. No raw Stripe payload storage.
- Used existing `StripeWebhookEventLog.updatedAt` as the processing lease timestamp to avoid a new migration.
- Used scoped `updateMany` for receipt reconcile writes to avoid read/write ownership drift.
- Kept reconcile rate limiting on existing in-memory limiter for this phase; distributed throttling can be revisited if API scales horizontally.

## Validation

- `pnpm -F @ella/api test -- stripe-webhook`
- `pnpm -F @ella/api test -- payments-staff`
- `pnpm -F @ella/api test -- stripe-payment-receipt-reconcile-service`
- `pnpm -F @ella/api type-check`
- `git diff --check`

## Next

Phase 6 handles broader automated coverage, documentation, rollout notes, and manual Stripe validation.
