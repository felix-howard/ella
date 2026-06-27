---
date: 2026-06-26
plan: plans/260626-1945-GH-260625-payment-ledger-receipts-stripe-customer-polish/plan.md
phase: 3
---

# Phase 03 Stripe Receipt Capture

## Context

Cooked Phase 3 of the payment ledger receipts and Stripe Customer polish plan:
checkout flows needed persistent Stripe Customer use plus receipt/invoice fact
capture when Stripe marks payments paid.

## What Happened

- Added a Stripe receipt facts helper for Checkout Session, Invoice, and PaymentIntent data.
- Deposit checkout now reuses open sessions, sends Stripe idempotency keys, uses persistent Client Customers, keeps lead email fallback, and syncs receipt facts after PAID side effects.
- Quote checkout now uses persistent Client Customers and requests Customer creation for lead-only one-time sessions.
- Quote fulfillment now records receipt/invoice fields, links converted clients to Stripe Customers, and wraps lead conversion plus first Payment insert in one transaction.
- Webhooks now persist `stripeInvoiceId` and extract PaymentIntent ids from newer invoice payment payloads.

## Decisions

- Receipt facts stay best-effort: payment status, agreement sync, and SMS do not depend on Stripe receipt retrieval.
- Non-unique `Payment.create` failures now throw; only `P2002` is treated as webhook duplicate.
- Duplicate deposit checkout risk is handled by reusing open sessions plus Stripe idempotency keys instead of adding a new local lock table.

## Validation

- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/api test -- deposit-checkout-service quote-checkout-service quote-fulfillment-service stripe-webhook checkout-persistence checkout stripe-customer-link-service stripe-receipt-facts`
- `pnpm -F @ella/api lint`

Result: 118 targeted tests passed. Lint has one existing warning in `apps/api/src/services/agreements/pdf-signature-page.tsx:44`.

## Next

Phase 4 should expose receipt fields to staff in the API/UI and keep the residual operational note visible: no true concurrent integration test yet, and duplicate open deposit sessions created before this fix remain a reconciliation case.
