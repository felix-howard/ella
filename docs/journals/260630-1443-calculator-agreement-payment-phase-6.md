---
date: "2026-06-30 14:43"
phase: 6
status: "complete"
component: "Calculator Agreement Payment Automation"
---

# Calculator Agreement Payment Phase 6

## Context
Phase 6 closed the public portal side of calculator-linked Engagement Letters. The goal was to let auto-send signers continue to the frozen quote payment page without creating checkout during signing or surprising them with an automatic redirect.

## What Happened
- Portal signing now carries `paymentPortalUrl` from the signed agreement response into the confirmation panel.
- Confirmation shows `Continue to payment` only when an activated quote URL exists.
- Signed PDF download remains available; it becomes secondary when payment continuation is available.
- Staff-review and legacy agreement confirmations stay PDF-only until staff explicitly sends the payment portal.
- Docs, changelog, and plan files now describe the completed Agreement-to-PaymentQuote lifecycle.

## Decisions
- Kept the portal action explicit instead of auto-redirecting after legal signing.
- Linked to existing `/quote/:payToken`; signing still does not create Stripe Checkout.
- Gated public payment visibility entirely on the backend returning `paymentPortalUrl`.

## Validation
- `pnpm -F @ella/api test -- src/services/agreements/__tests__/agreement-signing-service.test.ts src/routes/agreements/__tests__/agreement-draft-staff-routes.test.ts src/routes/clients/__tests__/agreements-staff-draft-routes.test.ts src/services/payments/__tests__/quote-checkout-service.test.ts src/routes/org-settings/__tests__/activity-logging.test.ts` pass, 5 files / 93 tests.
- `pnpm -F @ella/workspace test -- src/components/pricing/__tests__/calculator-engagement-letter-modal.test.ts src/components/pricing/__tests__/calculator-engagement-letter-modal-component.test.tsx src/components/pricing/__tests__/pricing-engagement-letter-panel.test.tsx src/components/agreements/agreement-draft-payload.test.ts src/components/agreements/agreement-card-payment-portal.test.tsx src/components/agreements/use-send-agreement-payment-portal.test.tsx` pass, 6 files / 28 tests.
- `pnpm -F @ella/portal test -- src/components/agreements/agreement-confirmation-panel.test.tsx src/components/agreements/agreement-error-panel.test.tsx src/components/agreements/agreement-error-mapping.test.ts src/lib/api-client.test.ts` pass, 4 files / 10 tests.
- `pnpm -F @ella/api type-check` pass.
- `pnpm -F @ella/workspace type-check` pass.
- `pnpm -F @ella/portal type-check` pass.
- `pnpm i18n:check` pass.

## Next
All phases in this plan are complete. Remaining rollout work is operational: apply the additive Prisma migration in the target DB, verify Stripe webhook event coverage, and review the org default setting after deploy.

**Status:** DONE
**Summary:** Phase 6 completed the public portal payment continuation, final validation, docs sync, and plan closure.
**Concerns/Blockers:** None.
