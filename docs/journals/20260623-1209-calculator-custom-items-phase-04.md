# Calculator Custom Items Phase 04

## Summary
- Completed final validation/docs pass for Calculator custom items.
- Payments Calculator custom add-ons now documented as complete across shared pricing, workspace UI, API validation, print, payment link, send-to-client, and portal checkout rebuild flows.
- Product decision recorded: Calculator supports `one_time` and `month` add-ons only; yearly recurring and custom-only charges stay in `Payments > Custom link`.
- Fixed review finding: workspace Print PDF no longer sends custom item labels in the URL query; the print page receives the payload by window message.

## Validation
- `pnpm -F @ella/shared test` passed, 15 tests.
- `pnpm -F @ella/workspace test -- pricing-calculator` passed, 18 tests.
- `pnpm -F @ella/api test -- billing` passed, 35 tests.
- Reviewer rerun: `pnpm -F @ella/shared test -- calculator quote-codec` passed, 15 tests.
- Reviewer rerun: `pnpm -F @ella/api test -- checkout payment-template-schemas` passed, 83 tests.
- `pnpm -F @ella/shared type-check` passed.
- `pnpm -F @ella/workspace type-check` passed.
- `pnpm -F @ella/landing type-check` passed, 0 diagnostics.
- `pnpm -F @ella/api type-check` passed.
- `pnpm type-check` passed, 8/8 packages successful.
- `git diff --check` passed.
- untracked-file whitespace check passed.
- Final code-review rerun found no remaining issues.

## Notes
- No Prisma migration.
- No env/manual setup needed.
- Unresolved questions: None.
