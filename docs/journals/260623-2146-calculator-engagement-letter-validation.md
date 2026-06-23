---
date: "2026-06-23"
status: completed-with-concerns
plan: "plans/260623-1640-calculator-engagement-letter-send-flow/plan.md"
---

# Calculator Engagement Letter Validation

## Context

Phase 4 validated the calculator Engagement Letter send flow after implementation of pricing cleanup, content generation, and workspace send wiring.

## What Happened

- Ran targeted shared, workspace, and API tests for calculator pricing, billing guards, recipient search, content builder, modal helpers, and readiness behavior.
- Ran package type-checks plus monorepo `pnpm type-check`; all passed.
- Updated docs to record that yearly business tax pre-pay stays in Custom Link and is only manual/editable copy inside generated Engagement Letters.
- Kept plan status as `completed-with-concerns` because authenticated browser smoke was not available in this agent session.
- Locally ignored `prompt/engagement-letter.md` through `.git/info/exclude` because it appears to contain client-identifying reference content.

## Decisions

- Do not mark this flow unqualified complete until an authenticated browser smoke confirms modal open, editor content, preview, and send.
- Keep yearly pre-pay out of Calculator structured fields for now; Custom Link remains owner of yearly business tax collection.
- Reuse existing Agreement APIs; no new backend agreement send route.

## Next

- Manual smoke with a signed-in admin org and a searchable recipient with phone.
- Commit with careful file selection; do not include ignored prompt reference content.
