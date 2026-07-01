# Message Reply Translation Phase 03

**Date**: 2026-06-29 14:18 Asia/Saigon  
**Severity**: Medium  
**Component**: workspace message composer, case chatbox, reply translation state  
**Status**: Resolved

## What Happened

Phase 03 wired the staff-facing reply translation UX into Workspace. Case conversations now support a per-conversation `Direct` / `EN -> VI` composer mode, a debounced editable Vietnamese SMS preview, and send metadata that preserves the staff-authored English draft privately. The full Messages route and floating case chatbox both support the flow; lead chat remains direct-only.

## Technical Details

Validation:
- `pnpm -F @ella/workspace type-check` pass
- `pnpm -F @ella/workspace test -- reply-translation quick-actions-bar use-reply-translation-preview` pass, 3 files / 12 tests
- `pnpm -F @ella/workspace lint` pass with existing unrelated warnings only

Review:
- Initial review found reply-mode save/list ordering risks.
- Follow-up debug found stale cache and first-failure optimistic rollback risks.
- Fixes added single-flight reply-mode saves, mode-load gating before composer render, send blocking while mode saves, cross-surface query-cache sync, and rollback removal for first failed chatbox sends.
- Final review reported no blockers.

## Decisions

- Translation logic lives in `useReplyTranslationPreview` and two small composer components to keep `QuickActionsBar` from absorbing all behavior.
- EN -> VI sends are blocked while preview state is loading, stale, errored, or empty.
- Reply mode remains per conversation and defaults to Direct only after the actual conversation mode is loaded.

## Next Steps

- Phase 04 adds `Show English` display for sent translated messages.
- Manual browser QA should still confirm the full Messages page and floating case chatbox flows with a configured Gemini key.
