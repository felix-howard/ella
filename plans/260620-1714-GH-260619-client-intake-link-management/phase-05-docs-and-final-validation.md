# Phase 05 - Docs and Final Validation

## Context Links
- [project changelog](../../docs/project-changelog.md)
- [system architecture](../../docs/system-architecture.md)
- [code standards](../../docs/code-standards.md)
- [project roadmap](../../docs/project-roadmap.md)

## Overview
- Priority: medium
- Status: complete
- Description: document the new intake-link management model and run final compile/test checks.

## Key Insights
- This change affects product IA, database fields, API contracts, public form submit behavior, and team profile UX.
- Docs should describe Settings as source of truth.
- Final validation must include DB migration status and workspace/API type checks.

## Requirements
- Update project docs after implementation.
- Run relevant tests and compile/type-check.
- Run code review after tests pass.
- Do not ignore failing tests.

## Architecture
- Docs should record:
  - Settings owns all intake link configuration.
  - Team profile only shows read-only personal intake shortcut.
  - Upload-link SMS language is explicit per org/staff config.
  - Public form client language no longer controls upload-link message language.

## Related Code Files
- Modify:
  - `docs/project-changelog.md`
  - `docs/system-architecture.md` if API/data model impact is substantial
  - `docs/codebase-summary.md` if feature ownership summary is outdated
  - `docs/project-roadmap.md` if milestone/progress status changes

## Implementation Steps
1. Read current roadmap/changelog before editing docs.
2. Add changelog entry for Client Intake management redesign.
3. Update architecture/docs only where behavior materially changed.
4. Run database validation:
   - `pnpm -F @ella/db migrate status`
5. Run targeted tests from Phase 04.
6. Run type checks:
   - `pnpm -F @ella/db type-check`
   - `pnpm -F @ella/api type-check`
   - `pnpm -F @ella/workspace type-check`
   - `pnpm -F @ella/portal type-check`
7. Run lint if time/cost acceptable:
   - `pnpm lint`
8. Delegate or perform code review per available workflow after tests pass.
9. Record validation notes in this phase file and update `plan.md` statuses.

## Todo List
- [x] Changelog updated
- [x] Architecture/codebase docs updated if needed
- [x] Migration status checked
- [x] Targeted API tests passed
- [x] Targeted workspace tests passed
- [x] Type checks passed
- [x] Lint run or skipped with reason
- [x] Code review completed
- [x] Plan statuses updated

## Validation Notes
- `pnpm -F @ella/db exec dotenv -e ../../.env -- prisma migrate status --schema prisma/schema.prisma` - passed, database schema up to date. `migrate dev --name client-intake-link-settings --skip-generate` was blocked by a pre-existing modified applied migration (`20260619104924_add_consent_7216_agreement`) and requested reset; no reset performed. Pending intake-link migration was applied with `prisma migrate deploy`, then status passed.
- `pnpm -F @ella/api test -- src/routes/form/__tests__/form-template-selection.test.ts src/routes/staff/__tests__/intake-link.test.ts src/routes/org-settings/__tests__/intake-links.test.ts src/routes/team/__tests__/team-routes.test.ts` - passed, 45 tests.
- `pnpm -F @ella/workspace test -- src/components/profile/__tests__/profile-tabs.test.tsx src/components/settings/__tests__/upload-link-message-settings.test.tsx src/components/settings/__tests__/client-form-link-card.test.tsx src/components/settings/__tests__/intake-link-table.test.tsx` - passed, 15 tests.
- `pnpm -F @ella/db type-check` - passed.
- `pnpm -F @ella/api type-check` - passed.
- `pnpm -F @ella/workspace type-check` - passed.
- `pnpm -F @ella/portal type-check` - passed.
- `pnpm i18n:check` - passed, workspace 2968 keys and portal 531 keys.
- `pnpm lint` - passed with warnings only: existing Fast Refresh warnings in `@ella/ui`, `@ella/api`, `@ella/workspace`, `@ella/portal`, plus existing workspace hook dependency warnings in `form-1099-nec-tab`.
- `git diff --check` - passed.
- Code review pass 1 found legacy staff mutation bypass and migration replay-safety concerns; both were fixed before final validation.
- Post-fix tester subagent confirmed migration status, focused tests, and API/workspace type-checks pass.
- Post-fix code reviewer confirmed the legacy route authorization and migration replay-safety findings are fixed.

## Success Criteria
- Docs match implemented behavior.
- DB schema is in sync.
- API and workspace compile.
- Relevant tests pass.
- No known UI path still configures intake links from Team Profile.

## Risk Assessment
- Broad lint may surface unrelated existing issues. Report separately; do not mask real failures.
- Documentation can drift if final implementation changes endpoint names. Update docs after code, not before.

## Security Considerations
- Confirm no docs include secrets, tokens, signed URLs, or credentials.
- Confirm public link docs do not imply upload magic links are reusable public URLs.

## Next Steps
- Stop after this phase. If more polish is desired, create a new follow-up plan.

## Unresolved Questions
- None.
