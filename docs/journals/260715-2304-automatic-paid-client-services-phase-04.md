---
date: 2026-07-15
session: automatic-paid-client-services-phase-04
---

# Journal: 2026-07-15 — Automatic Paid Client Services Phase 4

## Context

Phase 4 built the staff-safe `GET /clients/:clientId/paid-services` read model from frozen quote items and direct payment provenance. It exposes purchased service lifecycle without reopening the retired manual ledger or leaking financial and Stripe-sensitive data.

## What Happened

- Added exact source eligibility: signed Calculator Agreements and sent, client-linked Custom Links only. Direct Calculator checkout, unsigned/voided Agreements, anonymous links, and unsent Custom Links remain excluded.
- Used only direct `Payment.paymentQuoteId` relationships as paid/refunded evidence; legacy indirect matching and null-provenance payments stay invisible.
- Added strict source-specific parsers for frozen Calculator and Custom Link snapshots, normalizing only approved service fields.
- Derived category-specific lifecycle states. One-time/setup items follow the first `OTHER` settlement's paid/refunded state; recurring items use aggregate refund, terminal end, latest failure, and active evidence semantics.
- Isolated malformed quote groups so one invalid snapshot is omitted without failing valid groups or exposing parser details.
- Reused organization and assignment client scope. Cross-org and unassigned staff requests return 404 without revealing client existence.
- Kept the response whitelist free of amounts, payment tokens, Stripe identifiers, receipts, payment methods, and raw snapshots.
- Final validation passed: 36/36 tests, API type-check, build, lint, and 10/10 code review.

## Reflection

Building the projection from immutable source snapshots plus direct settlement provenance kept eligibility deterministic and avoided inventing a second service ledger. Strict parsing and per-group failure isolation protect staff usability while fail-closed scoping and a fixed DTO keep the endpoint safe for non-admin access.

## Decisions Made

| Decision | Rationale | Impact |
|----------|-----------|--------|
| Gate each quote source independently | Calculator and Custom Link purchase flows prove client intent differently | Only signed Calculator and sent client Custom purchases appear |
| Trust direct `Payment.paymentQuoteId` evidence only | Stripe-session inference and historical guesses are ambiguous | Projection remains deterministic and intentionally future-facing |
| Freeze strict parsers around stored snapshots | Current mutable quote data must not rewrite purchased services | Returned labels, categories, and cadence reflect the purchase-time record |
| Derive lifecycle per item category | One-time settlement and recurring health have different meanings | Refund, past-due, ended, and active states avoid false deactivation |
| Omit malformed groups independently | One corrupt snapshot must not break the client view | Valid service groups remain available with no sensitive diagnostics returned |
| Return one fixed staff-safe DTO | Paid Services needs operational facts, not financial administration data | Assigned staff can use the endpoint without amount, token, or Stripe exposure |

## Next Steps

- Execute Phase 5: build the Workspace Paid Services UI using only this API contract; keep quote eligibility and lifecycle logic server-side.
