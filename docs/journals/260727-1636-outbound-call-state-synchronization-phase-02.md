---
date: "2026-07-27 16:36 Asia/Saigon"
session: "260727-1636"
plan: "260726-2025-GH-260720-outbound-call-state-synchronization"
phase: 2
status: "resolved"
---

# Outbound Call State Synchronization Phase 02

## Context

Phase 02 closed the remaining outbound call lifecycle gaps after the callback plumbing from Phase 01. The work focused on keeping the live modal aligned with bridge and terminal SDK events under real callback ordering, not optimistic assumptions. No deployment or real Twilio smoke happened here, so this is validated code, not live traffic proof.

## What Happened

We tightened the global Voice SDK lifecycle so `ringing` stays timer-free until `accept/open`, one shared finalizer handles normal and error exits, and immediate `open`/`closed` SDK status is reconciled after listener registration. Local cancellation now invalidates pending connection work and falls back to Device disconnect when a late Call cannot disconnect cleanly.

The race discoveries were ugly but useful: incoming/outbound overlap, stale call-scoped Device errors, synchronous disconnect events, Strict Mode replay, and unmount during token/connect work could each clear the wrong call or leave work alive. Call identity history, lifecycle generations, and pending-attempt guards now isolate those cases. Validation was strong: 17/17 focused tests passed, Workspace type-check passed, scoped lint passed, `git diff --check` passed, and the final reviewer scored it 10/10.

## Reflection

This phase was annoying in the exact way concurrency bugs always are: the code looks fine until timing makes it lie. The frustrating part is how easy it would have been to ship a system that “usually works” and only breaks under live callback noise. We did not prove this against real Twilio traffic yet, so there is still a gap between clean validation and production confidence.

## Decisions Made

| Decision | Why | Rejected Alternative |
| --- | --- | --- |
| Keep the SDK hook as immediate UI authority | Preserves one Device and avoids route-local state machines | Add polling or a second realtime authority |
| Reconcile `Call.status()` after listeners attach | Closes events missed while `connect()` resolves | Trust listeners alone |
| Track lifecycle generation and Call identity | Stops stale setup/errors from clearing replacement calls | Infer ownership only from global call state |
| Validate with focused tests plus Workspace type-check and scoped lint | Catches the actual code path without pretending runtime smoke was done | Rely on compile success alone |

## Next Steps

Phase 03 should verify downstream behavior against the synchronized call state and close any remaining integration gaps. The current work is ready for the next phase, but not for a live Twilio smoke claim. Keep production validation separate.
