# Manager Role Phase 03: Server-Side Phone Masking

**Date**: 2026-06-07 14:20
**Severity**: Medium
**Component**: Phone privacy masking across API responses
**Status**: Resolved

## What Happened

Phase 03 implemented server-side phone masking for MANAGER role. Non-admin managers now see masked phone numbers (`*** *** 1234`) across all client-facing API responses, while operations that require raw phone (SMS, lead dedup, voice caller lookup) continue to use unmasked values. The implementation spans 18 response sites across 8 route files with a shared `phone-privacy.ts` library enforcing masking rules.

## The Brutal Truth

The frustrating part is that the surface was way bigger than the phase spec estimated. We planned for 4 locations (engagements, cases, actions, client-groups) and discovered 7 additional leak sites through systematic grep sweep. The MANAGER access model is incredibly fine-grained — phone appears in list responses, detail responses, nested includes, and local serializers. Miss one place, and masking fails silently in production. It's exhausting because you have to grep-verify the entire codebase, classify every hit, and justify why each one is safe or needs fixing.

The other irritating discovery: contractor phones (1099 payees) are intentionally unmasked. That's a design decision we flagged but didn't resolve — it's an open question whether staff should see full contractor contact info. Leaving that unresolved means future devs will have to justify the same decision again.

## Technical Details

New library: `apps/api/src/lib/phone-privacy.ts`
- `canViewFullPhone(orgRole, role)` — true only for `org:admin` or `ADMIN` role
- `maskPhone(phone)` — returns `*** *** 1234` format, null-safe, idempotent
- `serializePhone<T>(record: T, canMask: boolean)` — typed overload ensures non-null phone in → non-null phone out (required for ClientWithActions shared type)

Applied at 18 sites:
- `clients`: list/detail, group-siblings, create, patch
- `leads`: admin-create, list, detail, patch, convert-check
- `messages`: conversations detail
- `engagements`: list, detail (including nested `client: true` includes)
- `cases`: list, detail
- `actions`: list, detail
- `client-groups`: 4 sites via local `serializeGroupPhones` helper
- `team`: member-profile managed clients list

Key architectural decision: masking ONLY at response serialization. SMS sending, lead conversion dedup matching, voice caller lookup, portal routes, and Twilio webhooks all keep raw phone values. This is correct — MANAGER can still perform all operations; they just can't READ other people's phone numbers in responses.

Validation:
- `tsc` clean
- 2531 tests pass
- Code review score: 9.5/10 (minor `c`-shadowing fix in team/index.ts)
- Exhaustive grep sweep with classification table (zero unclassified hits) documented in `plans/reports/implementation-260607-1400-GH-20260605-phase-03-phone-masking.md`

## What We Tried

Initial approach: mutable phone masking at the ORM level via Prisma select. Rejected — we can't intercept before the shared type, and we'd lose type safety on non-null contracts.

Then: masking in each route handler individually. Works, but creates maintenance debt — 18 inconsistent implementations.

Final approach: shared library with typed overloads and a single source of truth. Cleaner, testable, and the type system catches violations.

## Root Cause Analysis

The original phase spec underestimated the response surface. The MANAGER access model is fine-grained enough that phone appears in many places — nested includes, group serializers, batch operations. We didn't have a systematic grep-and-classify step early, so we discovered drift late. The discovery also exposed a pre-existing STAFF DevTools leak (fixed during this phase).

## Lessons Learned

**Grep-classify early.** When implementing privacy rules that span the API, do a full codebase grep sweep and build a classification table BEFORE implementation. It takes an hour and prevents scope creep.

**Type safety for serialization.** Use typed overloads for serialization helpers. The type system will catch violations at compile time instead of you discovering them in production.

**Keep masking at response boundaries.** Don't try to mask at the ORM or permission layer — it breaks type contracts and creates confusion. Mask only when serializing for the API.

**Document decisions on gray areas.** Contractor phone masking is intentionally unmasked. This decision needs to be explicit in code comments or CLAUDE.md so future devs don't wonder if it's a bug.

## Next Steps

**Phase 4 (frontend):** formatPhone() passthrough for masked values (contains `*`). Spread-order matters — phone override must come AFTER `...record` spread, or masking gets clobbered.

**Phase 5 (testing):** Raw HTTP assertion tests for masked responses. Zero masking-specific tests exist — deferred to Phase 5 per plan.

**Open question:** Should contractor phones (1099 payees) be masked? Decision deferred to product review. Unresolved.
