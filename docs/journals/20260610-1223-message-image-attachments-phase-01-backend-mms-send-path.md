# Client Case Message Image Attachments Phase 01: Backend MMS Send Path

**Date**: 2026-06-10 12:23
**Severity**: Medium
**Component**: Messages API, SMS service, workspace API client, R2 attachment serialization
**Status**: DONE

## What Happened

Completed Phase 01 for outbound MMS on case-only message threads. Added the backend attachment upload helper for R2, wired `messages` send flow to pass Twilio `mediaUrl` payloads, removed MMS provider retry behavior, added the workspace API client method, and kept attachment serialization proxy-only so raw R2 keys never leave the server. Targeted API and workspace type-checks passed, plus 12 focused API tests.

## The Brutal Truth

This was not “just send an image.” The real work was keeping attachment state from leaking across layers. One sloppy serializer would have exposed storage keys, and one retry loop would have doubled sends or masked provider failures. The case-only boundary helped, but it also meant every helper had to be strict about scope instead of trying to be generic and clever.

## Technical Details

- `apps/api/src/routes/messages/message-attachment-upload.ts` stores MMS images in R2 under a message-scoped prefix.
- `apps/api/src/routes/messages/index.ts` sends outbound MMS with Twilio `mediaUrl` support for attached images.
- `apps/api/src/services/sms/message-sender.ts` and `apps/api/src/services/sms/twilio-client.ts` no longer retry MMS provider failures.
- `apps/workspace/src/lib/api-client.ts` now exposes the client method needed by the composer flow.
- Message attachment serialization stays redacted/proxy-only; `attachmentUrls` and `attachmentR2Keys` remain server-side data.
- Validation passed: `pnpm -F @ella/api type-check`, `pnpm -F @ella/workspace type-check`, focused Vitest on MMS send, media hardening, activity logging, and Twilio MMS behavior.
- `docs/project-changelog.md` was updated.

## What We Tried

- Considered link-in-body SMS behavior, rejected because it is not real MMS and weakens the attachment contract.
- Considered retrying provider failures, rejected because it risks duplicate sends and hides the actual MMS capability boundary.

## Root Cause Analysis

The old message flow had no first-class outbound attachment contract. That forced MMS support to be bolted on cleanly across upload, serialization, send, and client access in one pass. The bug class here was data leakage, not transport failure.

## Lessons Learned

- Keep storage identifiers server-only.
- Treat MMS media as first-class send data, not body text decoration.
- Make provider failure explicit; do not paper over it with retries.
- Scope the backend path tightly before expanding UI behavior.

## Next Steps

Phase 02 owns the frontend composer attachment UX and manual browser validation on `/messages/:caseId` and the floating case chatbox.

**Status**: DONE
