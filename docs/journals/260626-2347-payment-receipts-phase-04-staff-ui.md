# Payment Receipts Phase 04 Staff UI

Date: 2026-06-26
Plan: `plans/260626-1945-GH-260625-payment-ledger-receipts-stripe-customer-polish/plan.md`
Phase: `phase-04-staff-payments-api-and-workspace-ui.md`

## Summary

- Extended admin/org-scoped client payments API with Stripe customer/invoice/charge/receipt fields, payment method label, receipt sync time, and receipt status.
- Filtered receipt links to HTTPS Stripe receipt/invoice hosts before API serialization and again before Workspace renders external links.
- Added paid-row `Receipt` action, `Receipt pending` state, and payment method copy in client Payments tab.
- Made anonymous Stripe URL creation explicit in calculator and custom-link flows.
- Added EN/VI locale keys and focused API/UI tests.

## Validation

- `pnpm -F @ella/api test -- src/routes/clients/__tests__/payments-staff.test.ts` pass, 13 tests.
- `pnpm -F @ella/workspace test -- src/components/clients/client-payments-tab/client-payments-tab.test.tsx src/components/pricing/__tests__/pricing-payment-link-panel.test.tsx src/components/pricing/custom-link/__tests__/custom-link-actions.test.tsx` pass, 8 tests.
- `pnpm -F @ella/api type-check` pass.
- `pnpm -F @ella/workspace type-check` pass.
- `pnpm i18n:check` pass.
- API/workspace lint pass with unrelated pre-existing warnings only.
- Code review: 9.5/10, 0 critical, 0 warnings.

## Notes

- No Overview card receipt links added; Payments tab remains the receipt ledger.
- Phase 5 remains next for webhook observability and reconcile tools.

## Unresolved Questions

- None.
