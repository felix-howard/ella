---
date: 2026-06-23 17:38
branch: feature/next-task-5
phase: ck:cook phase 2
component: workspace pricing / engagement-letter builder
status: resolved
---

# Calculator Engagement Letter Builder

## Context

Phase 2 of `/plans/260623-1640-calculator-engagement-letter-send-flow/plan.md` only. Goal was to turn `PricingCalculatorInput` + `PricingCalculatorResult` into conservative engagement-letter HTML for the send flow.

## What Happened

Added `apps/workspace/src/components/pricing/engagement-letter-content-builder.ts`, exported it from `apps/workspace/src/components/pricing/index.ts`, and covered it with `engagement-letter-content-builder.test.ts`. The builder renders monthly and setup items, skips yearly items, includes editable yearly pre-pay copy, and escapes labels and notes so user content cannot bleed raw HTML into the letter.

The annoying part was the first review pass catching two weak spots: the yearly assertion was too loose, and note escaping had no direct test. Both were real misses, not theoretical ones. Fixing them before moving on kept the output honest.

## Decisions

Chose a small deterministic HTML builder instead of placeholder-heavy template text. Rejected yearly item rendering because Phase 2 only needs the monthly/setup flow exposed. Kept escaping inside the builder instead of leaving it to callers, because that is where the unsafe input actually enters.

## Next

Phase 2 is complete and validated with `pnpm -F @ella/workspace test -- engagement-letter-content-builder`, `pnpm -F @ella/workspace test -- pricing-calculator`, and `pnpm -F @ella/workspace type-check`. Phase 3 is next. Broader docs updates stay deferred to Phase 4. No commit was made.
