# Payment Templates Phase 02: API Service and Routes

**Date**: 2026-06-12 15:48 Asia/Saigon  
**Severity**: Medium  
**Component**: `apps/api` billing routes, payment template service, request schemas  
**Status**: Resolved

## What Happened

Phase 02 finished the org-scoped reusable payment template API. We added the billing schemas, route handlers, and service layer for list/create/update/archive, then covered the flow with route and service tests. The result is a real template API that reuses custom quote validation without coupling templates to quote creation.

## The Brutal Truth

The main risk was not code volume; it was edge behavior. Org scoping, archive semantics, and validation envelopes are where simple CRUD APIs become tenant-isolation work.

## Technical Details

Changed files:
- `apps/api/src/routes/billing/schemas.ts`
- `apps/api/src/routes/billing/payment-template-routes.ts`
- `apps/api/src/services/payments/payment-template-service.ts`
- route and service test files under `apps/api/src/routes/billing/__tests__/` and `apps/api/src/services/payments/__tests__/`

Key changes:
- Added a validation error envelope so schema failures return a stable API shape.
- Switched update/archive logic to `updateManyAndReturn` so org-scoped writes stay atomic and do not depend on a follow-up read.
- Added direct auth coverage for the billing template routes.
- Kept coupon, discount, and other non-template fields out at the schema boundary.

Validation:
- Focused Vitest run: 16 tests passed.
- API type-check passed.
- API lint passed with one existing unrelated warning in `apps/api/src/services/agreements/pdf-signature-page.tsx`.

## What We Tried

- Tried plain update-by-id flow first.
- Rejected it because it made org scoping and response return values too easy to split into separate steps.
- Added the envelope and direct auth tests instead of relying on generic route coverage.

## Root Cause Analysis

The real risk was trusting route-layer assumptions to protect tenant boundaries. That is how cross-org bugs and inconsistent errors sneak in. The fix was to make the service own the org constraint and make the API surface explicit about failure.

## Lessons Learned

- Org-scoped mutations should be atomic, not “find then maybe update.”
- Validation errors need one stable envelope or clients start guessing.
- Auth coverage has to hit the direct route path, not just the happy-path service call.

## Next Steps

Phase 03 should consume these endpoints from the workspace UI and keep the list/edit/archive contract unchanged.
