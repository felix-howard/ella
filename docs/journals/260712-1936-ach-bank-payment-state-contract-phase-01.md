---
title: "ACH Bank Payment State Contract Phase 01"
date: "2026-07-12 19:36 Asia/Saigon"
plan: "260712-1802-GH-260710-ach-bank-payment-ux-hardening"
phase: 1
status: "resolved"
---

# ACH Bank Payment State Contract Phase 01

## Context

Phase 01 locked down the public payment-state contract for ACH bank quote checkout. The goal was one stable public state for the portal, not a second guessing layer in UI. No schema migration. Docs impact none.

## What Changed

Added a public quote payment state presenter and exposed `publicPaymentState` in the API response. Supported values: `payable`, `redirecting`, `processing_bank_payment`, `paid`, `payment_failed`, `canceled_before_payment`, `subscription_canceled_after_payment`.

State derivation is deterministic now. It reads `PaymentQuote`, `StripeCheckoutSession` facts, and the first quote `Payment` row via the unique `qf_${sessionId}` payToken. That removes ambiguity when multiple rows exist. Added a direct `PAYMENT_PROCESSING` 409 guard for `awaiting_payment` checkout attempts. Portal quote API types were updated, but portal rendering still needs the follow-up phase.

## Decisions

Kept the state machine on the API side. That was the only reliable source of truth once webhook order and checkout retries enter the picture. Rejected portal-side inference because it would rot immediately. Also kept schema untouched; this was a contract change, not a data-model change.

## Validation

Passed:
- `pnpm -F @ella/api test -- src/services/payments/__tests__/quote-public-payment-state.test.ts src/services/payments/__tests__/quote-checkout-service.test.ts` (`34` passed)
- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/portal type-check`
- `pnpm -F @ella/api lint` with unrelated existing Fast Refresh warning
- `pnpm -F @ella/portal lint` with unrelated existing Fast Refresh warnings

Final code review score: `9/10`. No remaining findings.

## Next

Phase 02: `plans/260712-1802-GH-260710-ach-bank-payment-ux-hardening/phase-02-quote-reconciliation-and-duplicate-checkout-prevention.md`
