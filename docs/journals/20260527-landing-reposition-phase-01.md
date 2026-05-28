# Landing Reposition Phase 01

**Date**: 2026-05-27 13:09
**Severity**: Medium
**Component**: Landing app / marketing foundation
**Status**: Resolved

## What Happened

Completed Phase 01 of `plans/260527-1300-GH-20260527-reposition-landing-online-tax-services/plan.md`. The landing foundation moved from tax-firm SaaS positioning to Ella Tax Services LLC online tax services. Updated company config, service taxonomy, CTA labels, nav/footer/contact form, `ProfessionalService` structured data, the `/try-now` contact flow, and moved `/features` to `/services`.

## The Brutal Truth

We were still shipping old product-positioning copy inside the landing stack. That is exactly how a site ends up looking half-rebranded and untrustworthy. The exhausting part was not the edits. It was hunting every stale edge where the old SaaS story still leaked through.

## Technical Details

- Fixed CTA routing and preserved the `mailto:` value instead of normalizing it away.
- Tightened tablet nav behavior after review found a breakpoint regression.
- Updated schema to reference the correct logo asset for `ProfessionalService`.
- Removed hidden home/about copy that still referenced the old product.
- Validation passed: `pnpm -F @ella/landing type-check`, `pnpm -F @ella/landing lint`, `pnpm -F @ella/landing build`, and the targeted old-positioning audit.
- Docs validation passed with pre-existing warnings in untouched docs.

## What We Tried

- Centralized the new positioning in config first so copy stayed consistent.
- Audited visible pages and hidden text separately; the hidden remnants were the bigger risk.
- Applied review fixes immediately instead of letting routing, schema, and nav issues pile up.

## Root Cause Analysis

Root cause was stale positioning spread across components, not one bad page. CTA targets, structured data, navigation, and page copy all still carried product-era assumptions, so the rebrand needed cross-cutting cleanup instead of a simple text swap.

## Lessons Learned

- Repositioning work needs a stale-copy audit, not just page-by-page edits.
- CTA labels, routing, schema, and contact flow are part of the brand, not garnish.
- Hidden copy is a real product bug. If you only review visible pages, you miss the actual drift.

## Next Steps

- Resolve the open plan questions before Phase 02: named reps public, address prominence, pricing visibility, language strategy, real form endpoint.
- Owner: landing follow-up.
- Timing: before the next phase starts.

## Unresolved Questions

- Named reps public?
- Address prominence?
- Pricing visibility?
- Language strategy?
- Real form endpoint?
