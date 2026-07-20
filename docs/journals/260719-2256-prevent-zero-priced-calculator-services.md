---
date: 2026-07-19
session: prevent-zero-priced-calculator-services
status: completed
---

# Journal: 2026-07-19 — Prevent Zero-Priced Calculator Services

## Context

One included `$0` Calculator line could coexist with a positive quote total, then invalidate the strict Paid Services snapshot projection after payment. The goal was to prevent new invalid Calculator quotes without weakening the parser or rewriting historical data.

## What Happened

- Added one shared check for non-positive included Calculator lines and reused it at Workspace and API boundaries.
- Blocked payment link, Engagement Letter, send, and print actions until every included service is above `$0`.
- Added accessible Cash Plan participant guidance when enabled with no employee or owner.
- API bypasses now raise status-`400` `CheckoutQuoteError` without committed quote/agreement writes, SMS, or Stripe side effects; regressions verify the persistence guard.
- Kept Custom Link behavior, strict Paid Services parsing, and historical records unchanged.
- Validation passed: 3,863/3,863 tests, targeted Custom Link 14/14, package type-checks, Workspace/API production builds, lint with 0 errors and 15 known unrelated warnings, and `git diff --check`. Final review scored 10/10 with no findings.

## Reflection

Aggregate totals were the wrong invariant: a positive setup fee could hide an invalid `$0` monthly service. Validating each included line at the shared calculation boundary preserves downstream strictness and gives staff a fixable error before irreversible payment activity.

## Decisions

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Prevent invalid quotes at shared Workspace/API boundaries | All Calculator proceed paths converge there | UI gets immediate guidance; API bypasses fail safely |
| Keep the Paid Services parser strict | Relaxing it would conceal malformed paid snapshots | Projection contract remains trustworthy |
| Leave historical data untouched | Repair semantics were not safely inferable | No migration or risky data rewrite |
| Model invalid pricing as `CheckoutQuoteError` 400 | Staff input is correctable, not a server fault | Consistent client response with no committed invalid data |

## Next

- Commit and push through the normal review workflow when ready.
- Handle any historical malformed quotes only through a separately authorized, evidence-based repair plan.
