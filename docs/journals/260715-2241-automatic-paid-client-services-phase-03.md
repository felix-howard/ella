---
date: 2026-07-15
session: automatic-paid-client-services-phase-03
---

# Journal: 2026-07-15 — Automatic Paid Client Services Phase 3

## Context

Phase 3 made future quote-linked payments trustworthy lifecycle evidence before the paid-services read model is built. It synchronized actual Stripe settlements, full refunds, recurring recovery, and terminal cancellation without rewriting historical payments or deriving service rows yet.

## What Happened

- First quote payments now use Checkout `amount_total`; recurring rows use invoice `amount_paid`. Frozen quote totals remain fallback only when Stripe omits the authoritative amount, and zero recurring settlements do not create paid evidence.
- Added quote-scoped `charge.refunded` handling. Only a uniquely matched full refund changes `PAID` to `REFUNDED`; partial, duplicate, ambiguous, unrelated, and already-refunded events remain safe no-ops.
- Closed the refund-before-Payment race with durable webhook evidence and transaction-scoped PostgreSQL advisory locks. A late Payment is created directly as `REFUNDED`, with the normal paid notification suppressed.
- Applied additive migration `20260715152629_record_full_refund_webhook_evidence`, adding nullable payment-intent/full-refund evidence and lookup indexes to `StripeWebhookEventLog`; no existing rows or history were removed.
- Refined webhook precedence: newer or same-second `invoice.paid` can recover failed recurring health, failure cannot replace paid/active state at the same timestamp, stale failures do not alert, and subscription cancellation plus duplicate-review remain terminal.
- Final validation passed: 66/66 targeted tests, API and database type-checks, clean diff check, and 9.5/10 final review.

## Reflection

Persisting minimal refund facts solved the hardest webhook-order race without storing raw Stripe payloads or adding a second payment ledger. Explicit same-second precedence also made recovery deterministic while preserving cancellation and duplicate-review guardrails. Phase 3 now supplies reliable facts; service aggregation and staff visibility correctly remain later work.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Prefer Stripe settlement amounts | Coupons and promotions can make quote totals differ from collected money | New Payment rows reflect actual collected amounts while retaining guarded fallbacks |
| Treat only full refunds as `REFUNDED` | A partial refund does not erase the whole purchase | Phase 4 can derive service state without false deactivation |
| Persist minimal refund evidence before mutation | Refund webhooks can arrive before Payment creation | Either event order preserves refunded history idempotently |
| Let success recover failure, but keep terminal states sticky | Recurring failures are temporary; cancellation and duplicate review are not | Newer paid invoices restore Active health without reviving ended or review-required sessions |

## Next Steps

- Execute Phase 4: build the staff-safe paid-services read API from frozen quote items, signed-agreement eligibility, linked payments, and lifecycle health.
- Keep `charge.refunded` endpoint configuration and Stripe test-mode refund smoke in the Phase 6 rollout gate.
