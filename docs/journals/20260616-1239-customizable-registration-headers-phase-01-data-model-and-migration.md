# Customizable Registration Headers Phase 01: Data Model And Migration

**Date**: 2026-06-16 12:39 Asia/Saigon  
**Severity**: Medium  
**Component**: `packages/db` Prisma schema, migration, generated types  
**Status**: Resolved

## What Happened

Phase 01 landed the data model for customizable registration headers. We added Prisma enum `RegistrationHeaderMode` with `DEFAULT`, `CUSTOM`, and `HIDDEN`, added org registration header fields, added campaign form header fields, and created/applied migration `20260616054058_customizable_registration_headers`.

## The Brutal Truth

This was just schema plumbing, but schema plumbing is where teams get sloppy and pay for it later. The work is still useless until API and UI wiring exists, so the real risk was shipping a clean migration that nobody can actually use yet.

## Technical Details

- Added `RegistrationHeaderMode` to Prisma schema.
- Added org-level registration header fields.
- Added campaign form header fields.
- Created and applied migration `20260616054058_customizable_registration_headers`.

Validation passed:
- `prisma migrate dev`
- `prisma generate`
- DB package type-check
- `prisma migrate status`

## What We Tried

- Kept the change additive instead of touching downstream API/UI contracts.
- Deferred docs updates that depend on runtime behavior, since the new fields are not wired into API or UI yet.

## Root Cause Analysis

The feature needed a data model first because there was nowhere else to store header mode and header content. This phase had to stop at schema boundaries; pushing farther would have mixed persistence work with unready contracts.

## Lessons Learned

- Add the storage model first, but do not pretend the feature is done until contracts and UI consume it.
- Additive migrations are the only sane move for this kind of rollout.
- Deferring docs was the correct call because the public behavior is still incomplete.

## Next Steps

Phase 02 is Backend API Contracts. That phase should expose the new header fields cleanly and define how `RegistrationHeaderMode` maps into request/response shapes.

Unresolved questions: none.
