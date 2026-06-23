---
date: 2026-06-23
plan: plans/260622-2157-calculator-custom-items/plan.md
phase: Phase 03 - Checkout Send Print Summary Validation
---

# Calculator Custom Items Phase 03

## Context
- Cooked Phase 03 for Calculator custom item checkout, send, print, and summary validation.
- Phase 01/02 had already added shared pricing support, API schema support, and workspace row UI.

## What Happened
- Added shared workspace guard copy for incomplete custom item rows.
- Added custom-only Calculator guidance to send staff to Custom link.
- Verified custom rows appear in summary totals and survive checkout/send payloads.
- Added print quote codec round-trip coverage for custom items.
- Added sent quote snapshot and portal checkout rebuild tests for custom items.

## Decisions
- Keep Calculator custom items as add-ons only, not custom-only charges.
- Keep Stripe calculator checkout aggregated into existing monthly/setup lines.
- Keep docs polish deferred to Phase 04; current docs already cover the contract.

## Validation
- `pnpm -F @ella/workspace test -- pricing-calculator`
- `pnpm -F @ella/shared test -- quote-codec calculator`
- `pnpm -F @ella/api test -- quote-send-service quote-checkout-service checkout`
- `pnpm -F @ella/workspace type-check`
- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/shared type-check`

## Next
- Phase 04: final tests, docs, release polish.

## Unresolved Questions
- None.
