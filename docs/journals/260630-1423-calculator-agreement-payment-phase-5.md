---
date: "2026-06-30 14:23"
phase: 5
status: "complete"
component: "Calculator Agreement Payment Automation"
---

# Calculator Agreement Payment Phase 5

## Context
Phase 5 finished the staff-review path for calculator-linked agreements. The goal was simple: make the agreement card actionable for authorized staff without widening the default agreement payload or reopening the calculator flow.

## What Happened
- Workspace agreement cards now show the staff-review payment state and expose `Send payment portal` / `Copy payment link` actions.
- The explicit authorized client/lead agreement action endpoint returns `payUrl` only for that action path.
- Generic agreement list/read responses stay on the safe quote-summary contract: `id`, `status`, `sentAt`, `monthlyTotalCents`, `setupTotalCents`.
- No raw `payToken` and no derived `payUrl` leak through normal agreement serialization.

## Decisions
- Kept `payUrl` behind an authorized action endpoint instead of adding it to the default agreement payload.
- Treated staff-review payment send as a card action, not a calculator revisit. That keeps the UX local and avoids duplicate quote setup.
- Preserved copy/link fallback when SMS is skipped or fails so staff can still move the agreement forward.

## Validation
- `pnpm -F @ella/workspace test -- agreement-card payment-portal calculator-engagement-letter-modal-component` pass, 15 tests.
- `pnpm -F @ella/api test -- agreement-response-serializer agreements-staff-draft-routes agreement-draft-staff-routes` pass, 13 tests.
- `pnpm -F @ella/workspace type-check` pass.
- `pnpm -F @ella/api type-check` pass.
- `pnpm -F @ella/workspace lint` pass with existing warnings only.
- `pnpm -F @ella/api lint` pass with existing warning only.

## Next
Phase 6 is next: portal tests, docs, and final validation. This phase is done; the remaining work is public-facing confirmation and cleanup.

**Status:** DONE
**Summary:** Phase 5 closed the staff-review payment action path, kept generic agreement reads free of `payToken` and `payUrl`, and left Phase 6 as the next step.
**Concerns/Blockers:** None.
