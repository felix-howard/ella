---
date: 2026-06-29
topic: "Manager sensitive message redaction phase 1"
plan: "plans/260629-1728-GH-260628-manager-sensitive-message-redaction/plan.md"
phase: "phase-01-redaction-helper-and-contracts"
---

# Manager Sensitive Message Redaction Phase 1

## Context

Phase 1 locked the redaction primitive and response contract in `apps/api/src/lib/sensitive-message-redaction.ts`. The helper now decides what managers can read without mutating storage, and the focused test file keeps that contract pinned down. Validation stayed clean: 20 focused tests passed, API type-check passed, focused ESLint passed, helper coverage hit 100%, and review came back 9/10 with no critical issues after fixes.

## What Happened

We shipped the read-time redaction layer for sensitive messages. The annoying part is that this kind of privacy code looks tiny until every message shape is classified; one missed serializer leaks raw content into manager surfaces. The helper now redacts outbound-only content, clears `staffAuthoredContent` when content is redacted, and keeps template markers ahead of URL fallback so the result stays deterministic.

## Decisions

Redaction is read-time only. ADMIN keeps raw content. MANAGER, STAFF, and CPA get placeholders. Outbound-only messages are eligible. Template markers are checked first. URL fallback is limited to portal hosts plus relative payment/agreement paths, not arbitrary links. `staffAuthoredContent` is cleared on redaction so the UI cannot reconstruct private source text from leftover metadata.

## Next

Wire the helper into the route serializers in the next phase, then add regression coverage around each message surface that renders manager-visible content. Docs stay unchanged for now; docs impact stays none until route integration lands.
