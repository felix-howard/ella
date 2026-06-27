---
date: "2026-06-27"
branch: "feature/260625-next-work"
plan: "plans/260627-1631-GH-260625-pwa-web-push-client-messages/plan.md"
phase: 4
topic: "PWA web push workspace subscription UX"
---

# PWA Web Push Phase 4 Workspace UX

## Context

Phase 4 implemented the Workspace client-side push subscription experience for the PWA web push plan.

## What Happened

- Added Workspace service worker registration and `public/sw.js` notification handling.
- Updated PWA manifest and iOS web app meta tags.
- Added browser push helpers, Settings Notifications card, hook, API client methods, and EN/VI copy.
- Added `POST /push/current` so the UI treats a browser as enabled only after the API confirms the endpoint belongs to the authenticated staff member.
- Hardened notification privacy: service worker always displays generic Ella copy and only opens `/` or `/messages/*`.
- Fixed review findings around stale/shared browser subscriptions, disable ordering, iOS Home Screen guidance, service worker readiness, and React Query invalidation.

## Decisions

- Kept endpoint/key data out of the subscription list response.
- Used button actions instead of a switch because browser permission can fail and must start from a user gesture.
- Reused existing browser subscriptions during enable, then re-saved them through the authenticated API.
- Left broad rollout and production QA documentation for Phase 5.

## Validation

- `pnpm -F @ella/api test -- push-subscriptions` passed.
- `pnpm -F @ella/api type-check` passed.
- `pnpm -F @ella/api lint` passed with one unrelated warning.
- `pnpm -F @ella/workspace test -- web-push` passed.
- `pnpm -F @ella/workspace type-check` passed.
- `pnpm -F @ella/workspace lint` passed with unrelated warnings.
- `pnpm -F @ella/workspace build` passed with unrelated route/bundle warnings.
- `pnpm i18n:audit` still fails on unrelated active findings in `apps/workspace/src/lib/message-language-detection.ts`; locale parity passed.

## Next

Phase 5 should handle end-to-end device validation, rollout notes, and final docs.
