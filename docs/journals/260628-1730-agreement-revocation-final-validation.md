---
title: Agreement Revocation Final Validation
date: 2026-06-28
plan: plans/260628-1412-GH-260628-agreement-revocation/plan.md
status: completed
---

# Agreement Revocation Final Validation

## Context
Final cook pass for agreement revocation. Phase 5 closed the loop and all plan phases are now complete.

## What Happened
Agreement revocation now flows through `VOIDED` status, audit fields, staff revoke endpoints, Workspace revoke UX, and portal revoked-link state. Code review found a sign-vs-revoke race artifact cleanup issue: when the guarded signing update lost, generated signature and PDF artifacts were left behind. That was fixed by deleting those artifacts on the losing path.

## Decisions
Kept revocation state explicit instead of overloading a generic cancel path. `VOIDED` plus audit fields gives a cleaner trail for staff review and later support work. Kept the cleanup fix local to the guarded write path instead of adding broad background cleanup, because the race only exists at the contention point.

## Validation
Passed: DB migrate status, API type-check, focused API tests `121`, review-fix API tests `68`, workspace type-check and tests `15`, portal type-check and tests `6`, `i18n:check`, `git diff --check`. Docs updated: changelog, roadmap, system architecture.

## Next
Exclude unrelated `apps/landing/.astro/settings.json` from the commit. Verify the portal package and lockfile changes are intentional before committing.
