# Phase 01 - Database and API Contract

## Context Links
- [README.md](../../README.md)
- [schema.prisma](../../packages/db/prisma/schema.prisma)
- [org settings route](../../apps/api/src/routes/org-settings/index.ts)
- [staff route](../../apps/api/src/routes/staff/index.ts)
- [team route](../../apps/api/src/routes/team/index.ts)
- [public form route](../../apps/api/src/routes/form/index.ts)
- [upload template resolver](../../apps/api/src/services/sms/upload-link-template-resolver.ts)
- [workspace API client](../../apps/workspace/src/lib/api-client.ts)

## Overview
- Priority: high
- Status: complete
- Description: add explicit upload-link language + staff inheritance support, then expose one API contract for Settings-managed intake links.

## Key Insights
- `Organization` already stores `slug`, `autoSendFormClientUploadLink`, and `defaultUploadLinkTemplateId`.
- `Staff` already stores `formSlug`, `autoSendUploadLink`, and `defaultUploadLinkTemplateId`.
- Current public form submit resolves template language from `input.language`; this must change to configured link language.
- Current staff automation API only supports `/staff/me/auto-send-upload-link`; Settings needs admin/manager updates for any staff link.
- Current staff `autoSendUploadLink Boolean @default(false)` cannot represent "use organization default".

## Requirements
- Add explicit upload-link SMS language:
  - organization default language
  - optional staff override language
- Add staff inheritance mode:
  - use org default
  - custom staff settings
- Keep current public URLs:
  - `/form/:orgSlug`
  - `/form/:orgSlug/:staffSlug`
- Do not add client language auto-detection or client preference dependency.
- Use `prisma migrate dev --name <description>` for schema changes. Never use `prisma db push`.
- Preserve existing link behavior during migration where possible.

## Architecture
- Prisma additions:
  - `Organization.defaultUploadLinkLanguage Language @default(EN)`
  - `Staff.useOrgUploadLinkDefaults Boolean @default(true)`
  - `Staff.defaultUploadLinkLanguage Language?`
- Migration backfill:
  - Backfill org `defaultUploadLinkLanguage` from existing `smsLanguage` to preserve org-level behavior.
  - For existing staff with `formSlug IS NOT NULL`, `autoSendUploadLink = true`, or `defaultUploadLinkTemplateId IS NOT NULL`, set `useOrgUploadLinkDefaults = false` to preserve current staff-link behavior.
  - New staff links default to `useOrgUploadLinkDefaults = true`.
- API contract:
  - Extend `GET /org-settings` and `PATCH /org-settings` for `defaultUploadLinkLanguage`.
  - Add Settings-owned staff intake update endpoint:
    - `PATCH /staff/:staffId/intake-link`
    - admin/manager only
    - body: `formSlug`, `useOrgUploadLinkDefaults`, `autoSendUploadLink`, `defaultUploadLinkTemplateId`, `defaultUploadLinkLanguage`
  - Add list endpoint for the Settings table:
    - `GET /org-settings/intake-links`
    - returns org defaults, general link, and active staff links with effective settings.
- Public form submit:
  - Generic link uses org `autoSendFormClientUploadLink`, `defaultUploadLinkTemplateId`, `defaultUploadLinkLanguage`.
  - Staff link uses org defaults when `useOrgUploadLinkDefaults=true`.
  - Staff link uses staff custom settings when `useOrgUploadLinkDefaults=false`.
  - `input.language` may still be stored on the created client, but must not drive the upload-link SMS template language.

## Related Code Files
- Modify:
  - `packages/db/prisma/schema.prisma`
  - `apps/api/src/routes/org-settings/index.ts`
  - `apps/api/src/routes/staff/index.ts`
  - `apps/api/src/routes/form/index.ts`
  - `apps/workspace/src/lib/api-client.ts`
  - API tests listed in Phase 04
- Create:
  - migration under `packages/db/prisma/migrations/`

## Implementation Steps
1. Add Prisma fields to `Organization` and `Staff`.
2. Run `pnpm -F @ella/db migrate --name client-intake-link-settings`.
3. Edit migration SQL only if needed for safe backfill; raw SQL must use idempotent-safe patterns where applicable.
4. Run `pnpm -F @ella/db migrate status`.
5. Extend org settings schema/select/response/update with `defaultUploadLinkLanguage`.
6. Implement `GET /org-settings/intake-links` with:
   - org slug/defaults
   - general link config
   - active staff rows ordered by name
   - effective settings already resolved
7. Implement `PATCH /staff/:staffId/intake-link` with org-scope validation, admin/manager authorization, slug validation, slug uniqueness, and audit logging.
8. Keep existing `/staff/:staffId/form-slug` temporarily for backwards compatibility unless all callers are removed in the same phase.
9. Update public form submit to compute effective upload-link SMS config before `trySendWelcomeSms`.
10. Update workspace API client types and methods.

## Validation
- Passed: `pnpm -F @ella/db generate`
- Passed: `pnpm -F @ella/db type-check`
- Passed: `pnpm -F @ella/api type-check`
- Passed: `pnpm -F @ella/workspace type-check`
- Passed: focused API and workspace tests for intake links, activity logging, registration headers, staff slug behavior, and profile tabs.
- Blocker: `pnpm -F @ella/db migrate --name client-intake-link-settings` stayed blocked by pre-existing modified applied migration `20260619104924_add_consent_7216_agreement`; no reset performed.
- Note: `pnpm --dir packages/db exec dotenv -e ../../.env -- prisma migrate status --schema prisma/schema.prisma` reports `20260621144500_client_intake_link_settings` pending until migration sync is resolved.

## Todo List
- [x] Prisma fields added
- [x] Migration generated
- [x] Migration status verified
- [x] Org settings API extended
- [x] Intake link list API added
- [x] Staff intake link update API added
- [x] Form submit uses configured language
- [x] Workspace API client types updated

## Success Criteria
- API can list all active intake links for Settings.
- Admin/manager can update any active staff intake link from one API.
- Public form upload-link SMS language follows link config.
- Existing generic and staff form routes still validate and submit.

## Risk Assessment
- Migration can silently change staff-link auto-send behavior. Use conservative backfill for existing configured staff links.
- Reusing `smsLanguage` would keep language coupling. Add explicit upload-link language instead.
- Staff slug changes can break shared links. API and UI must keep warning copy.

## Security Considerations
- All staff link management endpoints must verify organization scope.
- Only admin/manager may manage organization-level intake links.
- Do not log SMS message body, phone, email, portal token, or magic link.
- Public form endpoints stay rate-limited.

## Next Steps
- Phase 02 builds the single Settings UI on top of these APIs.

## Unresolved Questions
- None.
