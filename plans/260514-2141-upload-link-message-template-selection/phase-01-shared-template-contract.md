# Phase 01: Shared Template Contract

## Context Links
- `research/scout-report.md`
- `apps/workspace/src/components/clients/client-sms-templates.ts`
- `apps/workspace/src/lib/api-client.ts`
- `packages/db/prisma/schema.prisma`
- `apps/api/src/routes/staff/index.ts`

## Overview
- Priority: High
- Status: Complete
- Define one stable contract for upload-link template ids across UI and API.

## Key Insights
- Create-client already has the desired template catalog.
- Backend cannot import workspace files, so API needs a small matching resolver or shared package placement.
- Fastest low-risk path: duplicate the two ids/content in API helper and keep ids stable.

## Requirements
- Functional: expose ids `official-channel`, `tax-documents`.
- Functional: validate unknown ids and fallback to `official-channel`.
- Non-functional: no breaking change for existing custom message sends.

## Architecture
- Frontend owns selector UI.
- API stores selected id on Organization for generic form links.
- API stores selected id on Staff for personal staff form links.
- API resolves selected id to message content at send time.

## Related Code Files
- Modify: `apps/workspace/src/components/clients/client-sms-templates.ts`
- Modify: `apps/workspace/src/lib/api-client.ts`
- Modify: `packages/db/prisma/schema.prisma`
- Create: `apps/api/src/services/sms/upload-link-template-resolver.ts`
- Create: `packages/db/prisma/migrations/<timestamp>_add_default_upload_link_template/migration.sql`

## Implementation Steps
1. Add helper `resolveClientSmsTemplateId(value)` in frontend template module.
2. Add `defaultUploadLinkTemplateId String?` to `Organization`.
3. Add `defaultUploadLinkTemplateId String?` to `Staff`.
4. Generate Prisma migration using `pnpm -F @ella/db prisma migrate dev --name add-default-upload-link-template` or repo equivalent.
5. Add API helper mapping ids to template content.
6. Keep fallback to current default if field is null/invalid.

## Todo List
- [x] Add Organization field.
- [x] Add Staff field.
- [x] Create migration.
- [x] Add API resolver.
- [x] Update frontend API types.

## Success Criteria
- Prisma client understands the new field.
- API can resolve selected template id without workspace imports.

## Risk Assessment
- Risk: content drift between frontend and backend hardcoded templates.
- Mitigation: stable ids and small helper; consider moving to shared package later if broader reuse grows.

## Security Considerations
- Template id is not user-sensitive.
- Continue org-scoped settings updates with admin-only PATCH.

## Next Steps
- Wire manual send UI after contract exists.

## Unresolved Questions
- None.
