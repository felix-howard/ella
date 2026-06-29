# Manager Sensitive Message Redaction Phase 2

**Date**: 2026-06-29 18:59 Asia/Saigon
**Severity**: High
**Component**: API message routes, translation guard, Workspace conversation types
**Status**: Resolved

## What Happened

Phase 2 moved sensitive-message redaction into the route-local serializer in `apps/api/src/routes/messages/index.ts`. The serializer strips storage keys and generates proxy URLs first, then redacts manager and non-admin automated quote, pay, and agreement messages on `GET /messages/conversations` and `GET /messages/:caseId` while keeping case and message metadata intact. `POST /messages/:messageId/translate` now fails closed with `SENSITIVE_MESSAGE_REDACTED` before any AI call when the message is redacted.

## The Brutal Truth

This was a privacy bug waiting to happen. The dangerous part was not the redaction logic itself, it was route drift: one response path could have leaked staff-only content while another looked safe. That is the kind of inconsistency that survives normal happy-path testing and turns into a production mess.

## Technical Details

- `Conversation.lastMessage` in Workspace now includes `templateUsed`, `twilioStatus`, and `updatedAt`.
- Manager and non-admin views redact sensitive automated quote/pay/agreement bodies.
- Admin passthrough stays unchanged.
- Tests were updated for manager no-leak JSON, admin passthrough, translation blocking, and the MMS fixture.
- Validation passed: API message route tests `42`, API type-check, Workspace type-check, workspace `conversation-list-item` tests `5`, scoped ESLint, and `git diff --check`.

## What We Tried

- A shared response post-processor was the obvious first idea, but it made ordering fuzzy and hid the storage-key, proxy URL, and redaction sequence.
- Keeping the serializer local was cleaner because the route owns the final shape and the translation guard can fail before the AI boundary.

## Root Cause Analysis

The root mistake was assuming one redaction layer was enough. It was not. The list/detail routes, translation route, and Workspace types all needed to agree on the same safe shape, and they did not until this phase forced them to.

## Lessons Learned

Never let sensitive-message handling spread across multiple ad hoc response shapes. If redaction affects routing, serialization, and AI calls, the safe path needs to be explicit, local, and tested from the start.

## Next Steps

Future message endpoints must reuse this serializer pattern and add a closed translation test before merge. The next owner should treat any new message shape as a privacy boundary, not just a UI contract.
