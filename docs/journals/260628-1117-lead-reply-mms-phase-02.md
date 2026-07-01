---
date: "2026-06-28"
plan: "plans/260627-2215-GH-260627-lead-reply-mms-visibility/plan.md"
phase: 2
topic: "Lead Reply MMS and Reply Fanout"
---

# Lead Reply MMS Phase 02

## Context

Cooked Phase 2 of lead reply visibility. Goal: make inbound lead SMS/MMS durable and staff-visible without adding lead conversations to the client Messages inbox.

## What Happened

- Added lead MMS persistence with Twilio media allow-list reuse and R2 keys under `lead-message-attachments/`.
- Updated lead inbound processing to save text/image replies, publish realtime, send privacy-safe web push, log activity, and coalesce one `LEAD_REPLIED` action.
- Added authenticated lead media proxy URLs and stripped `attachmentR2Keys` from lead message API responses.
- Completed `LEAD_REPLIED` actions when reads clear unread lead replies.
- Preserved unread state during lead-to-client conversion and serialized conversion/inbound races with a per-lead advisory lock.

## Decisions

- Used a transaction-scoped Postgres advisory lock instead of a new partial unique migration for open lead reply action coalescing.
- If conversion wins a race, inbound lead reply handling rechecks status after the lock and writes to the new client conversation with a `CLIENT_REPLIED` action.
- Kept lead MMS out of `RawImage`, OCR, checklist, and classification workflows until after normal client/case handling owns the message.

## Next

Phase 3 should wire workspace visibility: Leads nav/list badges, realtime invalidation, lead detail MMS rendering, and Actions UI polish.

## Unresolved Questions

None.
