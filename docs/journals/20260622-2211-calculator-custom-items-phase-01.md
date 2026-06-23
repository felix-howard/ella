# Calculator Custom Items Phase 01

**Date**: 2026-06-22 22:11 Asia/Saigon
**Severity**: Medium
**Component**: calculator pricing/API contract, Stripe checkout, public quote display
**Status**: Resolved

## What Happened

Phase 01 finished the shared pricing and API contract for calculator custom items. `customItems` now defaults to `[]`, accepts only `one_time` and `month`, and validates `label`, `amount`, `quantity`, and `count`. `calculatePricing` now rolls custom monthly/setup totals into the aggregate price, but custom-only calculator checkout stays blocked. Stripe calculator checkout still uses aggregate pricing only and does not leak custom labels into metadata or product names. The public quote display also got a source-aware fix so custom-link one-time labels stop being misclassified.

## The Brutal Truth

The easy version here would have been to treat custom items like generic line items and hope the UI sorted it out later. That would have been sloppy and it would have broken pricing semantics fast. The annoying part is that this had to be consistent across API, pricing, checkout, and quote display or the whole thing would lie to users.

## Technical Details

- `customItems` defaults to `[]`
- supported `kind` values: `one_time`, `month`
- validated fields: `label`, `amount`, `quantity`, `count`
- `calculatePricing` aggregates custom monthly/setup totals
- custom-only calculator checkout remains blocked
- Stripe checkout stays aggregate-only and strips custom labels from metadata/product names
- public quote display now uses source-aware label handling to avoid custom-link one-time misclassification

Validation:
- shared tests: 15
- API focused tests: 137
- `pnpm type-check`
- `git diff --check`

## What We Tried

- Kept custom items in the shared contract instead of scattering ad hoc parsing through API and UI.
- Rejected exposing custom labels in Stripe metadata/product names, because that leaks user-specific wording into a flow that should stay aggregate.
- Rejected allowing custom-only checkout, because the calculator still needs a broader priced context before checkout makes sense.

## Root Cause Analysis

The core risk was inconsistent interpretation of the same pricing object in different layers. Once labels, totals, and quote sources drift apart, the system starts producing false product identity. That is exactly how a pricing bug turns into a trust bug.

## Lessons Learned

- Keep pricing rules centralized or they will fork.
- Aggregate checkout and quote display need different data shapes; do not force one into the other.
- Source metadata matters when the same label can mean different things in different quote paths.

## Next Steps

Phase 02 should keep the same contract shape and extend coverage only where the data model actually needs it. No extra scope, no new label leakage, no loosening the checkout block until the product rules explicitly change.

## Unresolved Questions

None.
