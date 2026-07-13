# ACH Bank Payment Portal UX Phase 04

## Summary

Completed Phase 4 of ACH Bank Payment UX Hardening. Portal quote links now render bank-payment settlement as an explicit processing state instead of an indefinite short confirmation spinner.

## Changes

- Added quote payment view-state resolver for `publicPaymentState`.
- Added `Bank payment submitted` panel with 3-5 business day settlement copy, do-not-pay-again guidance, text receipt expectation, and `Check status`.
- Kept `Check status` on GET-only quote refresh through a tested helper.
- Kept `payment_failed` retryable and changed retry CTA copy.
- Separated no-charge cancellation copy from subscription-canceled-after-payment copy.
- Added fallback handling for legacy `awaiting_payment` and future non-startable public states.
- Extracted the quote pay card to keep the payment page more focused.

## Validation

- `pnpm -F @ella/portal test` passed, 9 files / 20 tests.
- `pnpm -F @ella/portal type-check` passed.
- `pnpm -F @ella/portal lint` passed with existing unrelated Fast Refresh warnings only.
- `pnpm i18n:check` passed.
- Final tester and code-reviewer subagents reported no blockers.

## Next

- Phase 5: Workspace monitoring, staff guardrails, and rollout docs.

## Unresolved Questions

- None for Phase 4.
