# Client Intake Link Management Redesign

## Status
- Phase 01: pending
- Phase 02: pending
- Phase 03: pending
- Phase 04: pending
- Phase 05: pending

## Goal
Move all client intake link configuration into one organization settings surface, remove the Team Profile `Form Link` tab, and show each staff personal intake link as read-only context in Overview.

## Scope
- Settings becomes canonical: `Settings > Organization > Client Intake`.
- General org intake link remains unassigned.
- Staff intake links assign new clients to that staff member.
- Upload-link automation is configured from Settings only.
- Message language is explicit: `English US` or `Vietnamese`. No auto language option.
- Team Profile Overview only shows/copies the personal intake link and links admins/managers back to Settings.

## Phase 01
- [ ] [Database and API Contract](phase-01-database-and-api-contract.md)

## Phase 02
- [ ] [Settings Client Intake UI](phase-02-settings-client-intake-ui.md)

## Phase 03
- [ ] [Team Profile Overview Shortcut](phase-03-team-profile-overview-shortcut.md)

## Phase 04
- [ ] [Tests and Locale Updates](phase-04-tests-and-locale-updates.md)

## Phase 05
- [ ] [Docs and Final Validation](phase-05-docs-and-final-validation.md)

## Key Dependencies
- Phase 02 depends on Phase 01 API/types.
- Phase 03 can start after Phase 01 types exist, but should integrate after Phase 02 route/focus decisions.
- Phase 04 depends on Phases 01-03.
- Phase 05 depends on all implementation phases.

## Success Criteria
- Users manage org slug, general intake link, staff links, upload SMS toggle, language, and template in one Settings section.
- Team profile no longer has a `Form Link` tab.
- Team Overview shows a compact read-only personal intake link card.
- Public form submit sends upload-link SMS using the configured link language, not client form language.
- Existing form URLs keep working unless slug is intentionally changed.

## Unresolved Questions
- None.
