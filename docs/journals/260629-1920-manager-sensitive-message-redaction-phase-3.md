---
date: 2026-06-29
time: 19:20
severity: high
component: api / leads message history
status: resolved
topic: "Manager sensitive message redaction phase 3"
plan: "plans/260629-1728-GH-260628-manager-sensitive-message-redaction/plan.md"
phase: "phase-03-lead-message-api-integration"
---

# Manager Sensitive Message Redaction Phase 3

## Context

Phase 1 locked the shared redaction helper. Phase 2 proved the route serializer pattern. Phase 3 wired the same helper into lead message history reads so non-admin viewers get safe output at read time, not after storage changes or send-path hacks.

## What Happened

The lead message history API now redacts automated outbound quote, pay, and agreement messages for `MANAGER` viewers. `ADMIN` still sees raw content. Ordinary inbound and outbound lead messages stay unchanged. Backfill, send, read, and unread behavior also stayed unchanged, which was the right boundary. The bug was never delivery; it was read access. If the serializer had skipped this helper, we would have kept a quiet privacy leak in the history view.

## Decisions

Read-time redaction is the enforcement point. No storage mutation, no special-case backfill rewrite, no hidden coupling with unread state. `MANAGER` gets generic placeholders for the sensitive automated outbound cases. `ADMIN` gets the full body. Everything else passes through untouched. That kept the fix narrow and made the permission boundary obvious in one route.

## Validation

- `pnpm -F @ella/api test src/routes/leads/__tests__/messages.test.ts` - 20 passed
- `pnpm -F @ella/api test src/lib/__tests__/sensitive-message-redaction.test.ts src/routes/messages/__tests__/sensitive-message-redaction.test.ts` - 25 passed
- `pnpm -F @ella/api type-check`
- `pnpm -F @ella/api exec eslint src/routes/leads/messages.ts src/routes/leads/__tests__/messages.test.ts`
- `git diff --check`
- Code review score: 9/10, 0 critical, 0 warnings

## Next

Phase 3 is complete. Next work is UI consumption only if a screen needs to mirror this read-time shape. Unresolved questions: none.
