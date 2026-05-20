# Comprehensive User Activity Log

Date: 2026-05-20

## Summary

Completed rollout for `ActivityLog` as canonical server-confirmed action timeline. Dashboard and client overview now consume safe activity DTOs instead of placeholder/proxy timeline data.

## Delivered

- Canonical action taxonomy and safe timeline DTO contract.
- Mutation instrumentation for messages, clients, cases, documents/images, upload links, team/settings/admin, leads, voice, retention jobs, and selected denied/security events.
- Org-scoped `/activity/recent` and client-scoped `/activity/clients/:clientId`.
- Shared workspace activity timeline UI with category filters, actor display, target summaries, risk badges, loading/error/empty states, and EN/VI copy.
- Rollout docs and QA checklist.

## Security Notes

Activity rows intentionally exclude message bodies, phone numbers, emails, addresses, raw SSN/TIN/EIN values, tokens, signed URLs, R2 keys, OCR/raw text, and long notes. UI list responses do not expose raw metadata, IP address, or user-agent.

## Follow-Ups

- Admin-only detail drawer/export.
- Activity retention policy.
- Optional page-view/session tracking only if compliance needs it.

## Unresolved Questions

- None.
