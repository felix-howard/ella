# Phase 04 - Tests and Locale Updates

## Context Links
- [form template selection tests](../../apps/api/src/routes/form/__tests__/form-template-selection.test.ts)
- [team route tests](../../apps/api/src/routes/team/__tests__/team-routes.test.ts)
- [profile tabs tests](../../apps/workspace/src/components/profile/__tests__/profile-tabs.test.tsx)
- [English locale](../../apps/workspace/src/locales/en.json)
- [Vietnamese locale](../../apps/workspace/src/locales/vi.json)

## Overview
- Priority: high
- Status: complete
- Description: update tests and locale keys for centralized Client Intake behavior.

## Key Insights
- Existing tests expect profile `Form Link` tab.
- Existing form tests already cover template selection.
- Locale files already have many form-link keys but need new names and removal/unused cleanup.
- Public form submit behavior change requires explicit tests so `input.language` does not accidentally drive upload-link SMS language again.

## Requirements
- Update API tests for explicit upload-link language.
- Update API tests for staff inheritance/custom settings.
- Update workspace tests for no profile Form Link tab.
- Keep English and Vietnamese locale parity.
- Do not fake implementation just to pass tests.

## Architecture
- API test coverage:
  - Generic org form uses org `defaultUploadLinkLanguage`.
  - Staff form with `useOrgUploadLinkDefaults=true` uses org auto-send/template/language.
  - Staff form with custom settings uses staff auto-send/template/language.
  - Staff form does not use `input.language` for upload-link SMS template selection.
  - Staff intake-link update rejects non-admin/non-manager.
  - Staff slug uniqueness still enforced.
- Workspace test coverage:
  - Profile tabs no longer render `profile.tabs.formLink`.
  - Overview renders personal intake link card.
  - Settings Client Intake renders language choices without `Auto`.
  - Copy/manage actions are present in expected states.

## Related Code Files
- Modify:
  - `apps/api/src/routes/form/__tests__/form-template-selection.test.ts`
  - `apps/api/src/routes/team/__tests__/team-routes.test.ts` or new focused staff intake-link route test
  - `apps/api/src/routes/org-settings/__tests__/*` if adding org intake link list tests
  - `apps/workspace/src/components/profile/__tests__/profile-tabs.test.tsx`
  - new/updated settings component tests if local patterns exist
  - `apps/workspace/src/locales/en.json`
  - `apps/workspace/src/locales/vi.json`

## Implementation Steps
1. Update API test fixtures to include new Staff and Organization fields.
2. Add form submit tests for effective language resolution.
3. Add endpoint tests for staff intake-link settings update.
4. Update profile tabs tests:
   - remove old form-link expectations
   - assert Overview card behavior
5. Add Settings UI test if practical with existing test setup.
6. Update locale keys:
   - `settings.clientIntake`
   - `settings.generalIntakeLink`
   - `settings.personalIntakeLink`
   - `settings.organizationUrlSlug`
   - `settings.sendUploadLinkAfterIntake`
   - `settings.uploadLinkMessage`
   - `settings.messageLanguageEnglishUs`
   - `settings.messageLanguageVietnamese`
   - `settings.useOrganizationDefault`
   - `profile.personalIntakeLink`
   - `profile.manageInSettings`
7. Remove or leave unused old keys only after checking references with `rg`.

## Todo List
- [x] API fixtures updated
- [x] Form submit language tests added
- [x] Staff intake-link endpoint tests added
- [x] Profile tabs tests updated
- [x] Settings UI tests added
- [x] Locale keys updated in EN and VI
- [x] Unused key references checked

## Success Criteria
- Tests fail if form upload-link SMS falls back to client form language.
- Tests fail if Team Profile form-link tab returns.
- Locale files stay valid and matching.

## Validation Methods
- `pnpm -F @ella/api test -- src/routes/form/__tests__/form-template-selection.test.ts src/routes/staff/__tests__/intake-link.test.ts src/routes/org-settings/__tests__/intake-links.test.ts src/routes/team/__tests__/team-routes.test.ts` - passed, 43 tests
- `pnpm -F @ella/workspace test -- src/components/profile/__tests__/profile-tabs.test.tsx src/components/settings/__tests__/upload-link-message-settings.test.tsx src/components/settings/__tests__/client-form-link-card.test.tsx src/components/settings/__tests__/intake-link-table.test.tsx` - passed, 15 tests
- `pnpm -F @ella/api type-check` - passed
- `pnpm -F @ella/workspace type-check` - passed
- `pnpm -F @ella/api lint` - passed with 1 existing warning
- `pnpm -F @ella/workspace lint` - passed with existing warnings
- Locale parity check - passed, EN/VI both 2968 keys

## Risk Assessment
- Frontend tests may rely on translation keys as rendered text. Update expectations carefully.
- API fixtures in multiple tests may need new default fields.

## Security Considerations
- Tests should include forbidden update cases for staff intake-link management.
- Tests should ensure org-scoped slug uniqueness cannot cross tenant boundaries incorrectly.

## Next Steps
- Phase 05 updates docs and runs broader validation.

## Unresolved Questions
- None.
