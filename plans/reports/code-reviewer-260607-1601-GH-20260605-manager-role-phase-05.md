# Code Review — MANAGER Role Phase 5 (Tests, Docs, Validation)

**Date:** 2026-06-07 16:13
**Branch:** codex-work-20260605-fresh-dev (uncommitted)
**Reviewer:** code-reviewer
**Plan:** plans/260606-2259-GH-20260605-manager-role/phase-05-tests-docs-validation.md

## Score: 9/10

Strong phase. Tests exercise real role-check code paths (only Clerk JWT + DB rows mocked, per plan requirement), all 63 new/extended tests pass, full api suite green (122 files / 2575 tests, zero skips — matches changelog claim exactly). Docs accurate. One genuine coverage gap (detail-endpoint nested phones) and a couple of "false-confidence" caveats keep it from 10.

## Verification performed
- Ran the 4 target files: 63 passed.
- Ran full `vitest run`: 122 files / 2575 tests pass — changelog's "122/2575 zero skips" is exact.
- Cross-checked every assertion against implementations (org-scope.ts, phone-privacy.ts, staff-role-mapping.ts, middleware/auth.ts, services/auth/index.ts) and route guards (clients/admin/team/leads index.ts).
- Confirmed doc-referenced file `staff-role-mapping.test.ts` exists and covers preserve/demote rules.

## Critical
None.

## Major
None.

## Minor

1. **Phone body-scan only covers list endpoints, not GET /clients/:id (coverage gap).**
   The raw-body scan (`RAW_PHONE_DIGITS` not.toMatch) runs against `GET /clients` and `GET /leads`. Both list responses serialize only the top-level `client.phone` (clients/index.ts:419, leads:256), so the scan is adequate *there*. But `GET /clients/:id` serializes additional nested **sibling phones** (clients/index.ts:844) via `serializePhone` — untested by the body scan. A regression that drops `serializePhone` on the sibling field would leak a full phone to MANAGER/STAFF and no test would catch it. Recommend adding one detail-endpoint body-scan case with a non-empty `taxCases`/sibling fixture.

2. **Auth "preserve MANAGER" test does not actually exercise the `isActiveMember` metadata-suppression guard.**
   The `membership` fixture has no `publicMetadata`, so `metadataStaffRole` is `undefined` regardless of the `isActiveMember ? undefined : metadata` branch (services/auth/index.ts:117-123). The test proves `resolveStaffRoleFromClerk('org:member','MANAGER',undefined) → MANAGER`, which is correct, but it would still pass even if the `isActiveMember` guard were removed. The actual regression risk — stale invite `publicMetadata.staffRole='STAFF'` on an active MANAGER re-sync — is unguarded by this test. Add a case where membership carries `publicMetadata: { staffRole: 'STAFF' }` on an active MANAGER and assert role stays MANAGER. (Unit-level `staff-role-mapping.test.ts` covers `resolveStaffRoleFromClerk` directly, but not the service's gating decision.)

3. **`RAW_PHONE_DIGITS = /4155551234/` is intentionally narrow but worth a comment-accuracy note.**
   The inline comment says "Any 7+ consecutive digits would indicate an unmasked phone leak" but the regex is the exact full number, not a 7-digit pattern. Not a correctness bug (masked output `*** *** 1234` correctly does not match the 10-digit run, and `1234` alone is fine), but the comment overstates what the regex does. A generic `/\d{7,}/` would be a stronger leak detector and would actually match the comment. Low priority.

4. **No negative/positive cross-check that MANAGER ≠ phone-viewer at the route level.**
   `canViewFullPhone` MANAGER=false is unit-tested, and the MANAGER list body-scan confirms masking. Good. No gap beyond #1.

## Positives
- Tests hit real `requireAdminOrManager` / `requireOrgAdmin` / `buildClientScopeFilter` / `serializePhone` — no mocked role logic. Matches plan's "no fake/mock cheats" rule.
- MANAGER team-mutation 403s correctly route through `requireOrg`→`requireOrgAdmin` (team applies these internally; test mounts only authMiddleware, still produces correct 403).
- `buildClientScopeFilter` MANAGER org-wide assertion checks both positive (`{organizationId}`) and negative (`not.toHaveProperty('managers')`) — catches accidental over-scoping.
- Failsafe edge cases covered: MANAGER no-org → `__NO_ACCESS__`, admin no-org, non-admin org+no-staffId.
- ADMIN positive phone assertions (full number present in body) balance the negative MANAGER/STAFF scans — proves masking is role-conditional, not blanket.
- Docs: role matrix, RBAC regression test map, mandatory helper rule all accurate; `staff-role-mapping.test.ts` reference verified to exist; changelog test counts verified exact.

## Out-of-scope observation (not a Phase 5 defect)
clients/index.ts:2070/2087/2132/2339 use raw phone — confirmed these are write inputs (`data:`/`where:` for create + uniqueness check), not response serialization, consistent with the documented "internal logic keeps raw values" contract. No leak.

## Unresolved questions
1. Is GET /clients/:id (detail, with sibling phones) considered in-scope for the matrix? If yes, add a body-scan case (Minor #1).
2. Should the "stale invite metadata on active member" path get an explicit service-level test, or is the unit coverage in staff-role-mapping.test.ts deemed sufficient (Minor #2)?
