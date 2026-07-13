# ACH Bank Payment Duplicate Checkout Phase 2

**Date:** 2026-07-12 ICT
**Plan:** `plans/260712-1802-GH-260710-ach-bank-payment-ux-hardening/plan.md`
**Phase:** 2 - Quote Reconciliation And Duplicate Checkout Prevention

## Summary

Phase 2 made public quote checkout creation conservative for ACH/bank-payment settlement delay. Public quote GET and POST now reconcile ambiguous local Checkout sessions from Stripe before rendering or creating a new session. POST fails closed when Stripe cannot verify an ambiguous prior session, so a client cannot get a second Checkout URL just because an ACH-completed session expired locally.

## Key Changes

- Added quote Stripe reconciliation split into focused service/classifier modules.
- Used public quote payment state as the checkout guard for paid, canceled, processing, and unverified states.
- Returned structured `PAYMENT_PROCESSING` for pending/unverified bank payment states.
- Updated Portal quote API/page handling so processing responses stay in confirming state instead of returning to pay-ready.
- Redacted public pay tokens from reconciliation logs.

## Decisions

- Terminal paid/failed reconciliation uses observed reconciliation time for local freshness. Stripe object creation time can predate the local `checkout.session.completed` event, so using object creation time could incorrectly block self-heal.
- Stripe retrieval failure on an expired/ambiguous local session blocks new public checkout creation. This favors duplicate-charge prevention over immediate retry.

## Validation

- API focused quote tests passed, 39 tests.
- Portal quote API tests passed, 2 tests.
- API and Portal type-check passed.
- API and Portal lint passed with unrelated existing Fast Refresh warnings only.

## Unresolved Questions

- None for Phase 2. Phase 3 still needs webhook fulfillment/idempotency hardening for historical duplicate sessions.
