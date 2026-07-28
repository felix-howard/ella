---
date: "2026-07-27 10:33 Asia/Saigon"
session: "260727-1033"
plan: "260726-2025-GH-260720-outbound-call-state-synchronization"
phase: 1
status: "resolved"
---

# Outbound Call State Synchronization Phase 01

## Context

Phase 01 wired outbound call lifecycle state to the callback contract instead of guessing from partial Twilio facts. The goal was a single deterministic path for answer, progress, terminal updates, and recording ownership. No deployment, Twilio Console verification, or real-call smoke happened in this phase.

## What Happened

We added `answerOnBridge` and `Number` progress callbacks, then made the signed `messageId` URL the callback entry point. Callback correlation now follows `messageId -> ParentCallSid -> legacy-only CallSid` so the modern path stays primary while the old field remains fallback-only.

The terminal update path is now first-terminal-wins and atomic, so duplicate webhook races stop flipping state back and forth. Parent recording SID preservation also landed, which keeps the parent recording attached even when the child leg finishes first. A debugger finding in the correlation path was fixed as part of this phase instead of being hand-waved away.

## Reflection

This was one of those phases where the bug is not dramatic until concurrency hits it, then it becomes a mess fast. The frustrating part is how easy it would have been to keep “working” code that was silently non-deterministic. That kind of code only fails under real traffic, which is exactly why it is dangerous.

## Decisions Made

| Decision | Why | Rejected Alternative |
| --- | --- | --- |
| Use signed `messageId` URLs | Keeps callback routing tied to the call record we own | Plain unauthenticated callback lookup |
| Correlate `messageId -> ParentCallSid -> legacy-only CallSid` | Preserves the modern path while keeping backward compatibility | Treat legacy `CallSid` as the primary key |
| Make terminal updates first-terminal-wins and atomic | Prevents duplicate callbacks from clobbering final state | Last-write-wins updates |
| Preserve parent recording SID | Keeps the parent recording attached across leg transitions | Recompute recording ownership later |

## Next Steps

Phase 02 should validate the downstream consumer behavior and close the remaining integration gaps. Validation for this phase passed: 82/82 tests, type-check, diff check, and final review scored 10/10.
