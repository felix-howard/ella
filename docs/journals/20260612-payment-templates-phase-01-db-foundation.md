# Payment Templates DB Foundation

**Date**: 2026-06-12 15:16 Asia/Saigon  
**Severity**: Low  
**Component**: `packages/db/prisma` payment templates schema + migrations  
**Status**: Resolved

## What Happened

Phase 01 landed the database foundation for reusable payment templates. We added org-scoped persistence for `PaymentTemplate`, kept template payloads limited to reusable line items, and wired tenant-safe creator attribution so template data stays inside the correct organization.

## The Brutal Truth

This was the point where a naive FK-only design would have been wrong. Cross-tenant creator attribution is exactly the kind of bug that looks harmless until it leaks data or breaks staff reassignment later. The annoying part is that Prisma does not give us the full constraint shape we need, so the database had to do the hard part with raw SQL.

## Technical Details

Changed files:
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/20260612151804_add_payment_templates/migration.sql`
- `packages/db/prisma/migrations/20260612152501_add_payment_template_tenant_guard/migration.sql`
- `packages/db/prisma/migrations/20260612153014_clear_payment_template_creator_on_staff_org_change/migration.sql`
- `packages/db/prisma/migrations/20260612153448_lock_payment_template_creator_staff_row/migration.sql`

Key decisions:
- `PaymentTemplate` is org-scoped, with soft archive via `archivedAt`.
- Active template names are unique per org only when `archivedAt IS NULL`.
- `createdByStaffId` stays optional and `ON DELETE SET NULL` remains intact.
- Raw triggers enforce creator org scope and clear stale attribution when staff changes orgs.
- `FOR SHARE` on `Staff` closes the race between template writes and staff org updates.

Validation recorded in the phase plan:
- `pnpm -F @ella/db exec dotenv -e ../../.env -- prisma validate`
- `pnpm -F @ella/db type-check`
- `pnpm -F @ella/db exec dotenv -e ../../.env -- prisma migrate status`

## What We Tried

- Tried to keep the model purely declarative in Prisma.
- Rejected that because Prisma cannot express the partial unique index and the tenant guard needed here.
- Used raw migration SQL instead, because correctness mattered more than ORM purity.

## Root Cause Analysis

The real requirement was not “store templates.” It was “store templates without letting organization boundaries blur.” The constraint gap is in Prisma, not the domain model. The fix is database-level enforcement, not application hope.

## Lessons Learned

- If a rule protects tenant isolation, do not leave it to app code alone.
- If the ORM cannot express the constraint, write the SQL and move on.
- Lock the row when write-time validation races with org reassignment.

## Next Steps

Phase 02: API schemas, service, and routes. Build CRUD on top of this foundation and keep the JSON payload validation strict so discount, recipient, Stripe, and client-specific fields stay out of templates.
