---
date: 2026-07-16
session: automatic-paid-client-services-phase-06-smoke
status: in-progress
---

# Journal: 2026-07-16 — Automatic Paid Client Services Phase 6 Smoke

## Context

Authenticated Stripe test-mode browser smoke continued after Phase 6 automated validation/docs. Goal: verify service projection, lifecycle, refund retention, ACH delayed settlement, and role boundaries without exposing client or Stripe-sensitive identifiers.

## What Happened

- Authenticated ADMIN test passed.
- Signed Calculator card checkout appeared once in Services.
- Client-linked Custom Link card settlement appeared once in Services.
- Recurring failure, recovery, and cancellation mapped Past Due → Active → Ended without duplicate service.
- Full refund retained the service as Refunded.
- Admin Payments retained financial details; Services stayed the safe lifecycle view.
- First Custom Link webhook failed with Prisma `P2010`. `$queryRaw` attempted to deserialize PostgreSQL `void` returned by `pg_advisory_xact_lock`.
- Changed the advisory-lock call to `$executeRaw`. Replayed the exact failed signed webhook request; it processed successfully once.
- Corrected the earlier ACH diagnosis: the direct Stripe test account supports ACH, and sessions explicitly including `us_bank_account` worked. Adaptive Pricing had localized USD Checkout to VND in the current locale, suppressing ACH because Stripe ACH Direct Debit requires USD presentment and uses delayed settlement.
- Updated the shared quote Checkout builder to explicitly request `card`, `link`, and `us_bank_account`, disable Adaptive Pricing, and reject non-USD `STRIPE_CURRENCY` with `CheckoutQuoteError`. Signed/client-linked, direct Calculator, and Custom quote builder paths now share the same USD contract.
- Signed Calculator ACH smoke displayed US bank account. Verified `checkout.session.completed` with `payment_status=unpaid` returned 200 and kept linked Payment count at zero. Verified `checkout.session.async_payment_succeeded` returned 200 and produced exactly one PAID Payment plus one new Active service group.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Keep Phase 6 and rollout in progress | Legitimate STAFF/CPA scope smoke remains | No premature release claim |
| Use `$executeRaw` for advisory-lock statements | Lock returns `void`; no result rows need deserialization | Prevents Prisma `P2010` during webhook settlement |
| Fix quote Checkout to USD and explicit supported methods | Adaptive Pricing localized presentment to VND and suppressed USD-only ACH | All quote paths display ACH when eligible; non-USD config fails clearly |
| Keep ACH as a production environment prerequisite | Payment-method enablement is environment-specific even though direct-account test smoke passed | Retain `STRIPE_CURRENCY=usd`; enable and verify ACH per test/live environment |
| Require legitimate same-org STAFF/CPA credentials | Role/scope smoke must use real Clerk membership and assignments | Staff-safe and uniform 404 checks remain trustworthy |

## Validation

- Preserved earlier Phase 6 metrics: 106 migrations; API 95/95; Workspace 59/59; full suite 3,863/3,863; lint 0 errors/35 known warnings; type-check 8/8; build 4/4.
- Post-fix focused API tests: 65/65 passed.
- Checkout simplifier tests: 27/27 passed.
- Independent focused tester: 191/191 passed; API type-check and diff-check passed.
- USD-hardening follow-up: 97/97 passed; API type-check and diff-check passed.
- Final review approved with no findings or warnings.

## Remaining Release Gates

- Provision a legitimate same-org Clerk STAFF/CPA account and client assignments. Verify no financial fields in Services plus uniform 404 for unassigned/cross-scope access.

Production rollout still requires `STRIPE_CURRENCY=usd` and ACH enablement/verification in every Stripe environment.

## Unresolved Questions

- When will the legitimate same-org STAFF/CPA account and required assigned/unassigned client scope be provisioned for final smoke?
