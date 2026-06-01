# Stripe Webhook Phase 04 Journal

Date: 2026-05-31

## Summary
- Added public `POST /webhooks/stripe` route with raw-body `Stripe-Signature` verification.
- Added Stripe webhook handler for checkout completion, async payment success/failure, invoice paid/failed, and subscription deletion.
- Synced `PaymentQuote` and `StripeCheckoutSession` status without trusting success redirects.

## Decisions
- `checkout.session.completed` only fulfills when `payment_status` is `paid`; unpaid delayed methods become `awaiting_payment`.
- Existing local `StripeCheckoutSession.paymentQuoteId` wins over Stripe metadata when both exist.
- Positive invoice/subscription events do not revive canceled quotes.

## Validation
- `pnpm -F @ella/api test -- stripe-webhook.test.ts` passed.
- `pnpm -F @ella/api type-check` passed.
- `pnpm -F @ella/api test` passed: 116 files, 2450 tests.

## Unresolved Questions
- Should successful payment trigger SMS/email to staff or customer in v1?
- Should paid quote auto-create/attach a `Lead` or `Client`, or only store standalone payment records first?
