---
title: Manager Sensitive Message Redaction Phase 4
date: 2026-06-29 19:45 Asia/Saigon
severity: Medium
component: manager-sensitive-message-redaction
status: Resolved
---

# Manager Sensitive Message Redaction Phase 4

## Context

Phase 4 closed out the manager sensitive message redaction work. Goal was simple: keep sensitive message content out of manager-facing responses while preserving the existing UX and payload shape.

## What Happened

Redaction landed at the response boundary, not deep in the message model. That kept the blast radius small and avoided a wider rewrite of send/message code. The annoying part was the generic send path still sitting close enough to manager flows that the serializer choice mattered more than expected.

## Decisions

Kept the fix narrow and explicit. I did not try to "clean up" the whole messaging stack in the same pass, because that would have turned a redaction patch into a refactor with extra risk. Chose to preserve current manager response contracts, then harden the sensitive fields at serialization time.

Code review had no blockers. Residual risk stays documented: generic send responses should reuse the same serializer if automated sends ever route through them. If that path gets added later and skips the redaction layer, we will leak data again.

## Validation

- API targeted tests: 53 passed
- API type-check: passed
- `git diff --check`: passed
- Manual setup: none

## Next

No follow-up work required for this phase. If automated send flows are added later, wire them through the existing serializer instead of inventing a parallel response path.

**Status:** DONE
**Summary:** Phase 4 completed, redaction verified, no blockers from review or validation.
**Concerns/Blockers:** Generic send responses should reuse the serializer if automated sends ever route through them.
