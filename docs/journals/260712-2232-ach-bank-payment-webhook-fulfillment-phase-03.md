---
date: "2026-07-12 22:32 Asia/Saigon"
plan: "260712-1802-GH-260710-ach-bank-payment-ux-hardening"
phase: 3
topic: "ACH bank payment webhook fulfillment and subscription cancellation semantics"
---

# ACH Bank Payment Webhook Fulfillment Phase 03

## Context

This phase was pure state-hardening. The bug surface was ugly: duplicate ACH settlement, webhook replay, and subscription deletion all wanted to mutate the same quote/session rows. It is the kind of work that disappears when correct and becomes a mess the moment ordering shifts.

## What Happened

- Added a quote-level first-payment guard with a quote row lock, then scoped existing `Payment` lookup to checkout sessions for the current quote only.
- On duplicate successful ACH/session settlement, `StripeCheckoutSession.status` now flips to `duplicate_paid_review`, we verify the marker write count, suppress the second client receipt, and send only the staff/admin duplicate-review alert.
- Duplicate-review sessions are sticky. They are excluded from subscription invoice/failure quote updates and from recurring/failure fulfillment.
- Subscription deletion no longer raw-cancels paid or active quotes, or paid subscription sessions. Cancellation now applies only to non-duplicate unpaid sessions.
- Public payment state now recognizes `subscription_canceled` after payment even if the quote raw status stays `active`.
- Initial review caught duplicate-review follow-up gaps and a broad fallback path. Both were fixed before final approval.

## Decisions

- Treat duplicate-paid sessions as a terminal review state, not a recoverable normal-paid state.
- Prefer sticky exclusion over trying to patch downstream side effects after the fact.
- Keep the schema unchanged. This was logic hardening, not a migration.
- Separate public payment state from raw quote status so the UI stays honest without rewriting settled records.

## Impact

- Prevents double settlement from sending a second client receipt or re-running fulfillment.
- Stops paid subscriptions from being incorrectly canceled on quote deletion.
- Validation passed: `pnpm -F @ella/api test -- payment` across 5 files / 76 tests, `pnpm -F @ella/api type-check`, and `pnpm -F @ella/api lint`.
- Lint still shows an existing unrelated Fast Refresh warning, nothing introduced here.
- Final reviewer blocker was cleared.

## Next

Phase 3 is complete. No further code changes are required for this slice; watch future webhook work for any new settlement edge cases.
