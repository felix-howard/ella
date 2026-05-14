# Phase 03: Auto-Send Default Template Setting

## Context Links
- `apps/workspace/src/components/settings/client-form-link-card.tsx`
- `apps/workspace/src/components/profile/staff-form-link-card.tsx`
- `apps/api/src/routes/org-settings/index.ts`
- `apps/api/src/routes/staff/index.ts`
- `apps/api/src/routes/team/index.ts`
- `apps/api/src/routes/form/index.ts`
- `apps/api/src/services/sms/message-sender.ts`

## Overview
- Priority: High
- Status: Complete
- Let admins pick which upload-link message template generic self-serve auto-send uses.
- Let staff pick which upload-link message template their personal form auto-send uses.

## Key Insights
- Org form auto-send is org-level boolean today.
- Staff form auto-send is staff-level boolean today.
- Public form route has no authenticated user, so the setting must live on Organization.
- Public staff-link submissions can read the matching Staff row before sending.
- `sendWelcomeMessage` custom-message path already supports desired placeholders.

## Requirements
- Functional: Settings Form Links shows template selector near auto-send toggle.
- Functional: selected template persists in org settings.
- Functional: Staff Profile form link card shows personal template selector near its auto-send toggle.
- Functional: personal selected template persists in staff settings.
- Functional: generic public form auto-send uses org selected template id.
- Functional: staff-link public form auto-send uses staff selected template id first.
- Functional: staff-link public form auto-send falls back to org selected template id when staff selection is blank.
- Functional: when disabled, keep selected template saved but do not send.
- Non-functional: admin-only settings update remains enforced.
- Non-functional: staff template update is limited to current staff profile unless an admin endpoint is intentionally added.

## Architecture
- Organization gets `defaultUploadLinkTemplateId`.
- Staff gets `defaultUploadLinkTemplateId`.
- `/org-settings` GET/PATCH includes the field.
- `/staff/me` and the auto-send update endpoint include staff default template field.
- Team profile response includes staff default template field so the card can render saved state.
- Workspace `OrgSettings` type includes it.
- Workspace `StaffProfile` type includes it.
- Public generic form selects `org.defaultUploadLinkTemplateId`, resolves content, passes as `customMessage`.
- Public staff form selects `staff.defaultUploadLinkTemplateId ?? org.defaultUploadLinkTemplateId`.

## Related Code Files
- Modify: `packages/db/prisma/schema.prisma`
- Modify: `apps/api/src/routes/org-settings/index.ts`
- Modify: `apps/api/src/routes/staff/index.ts`
- Modify: `apps/api/src/routes/team/index.ts`
- Modify: `apps/api/src/routes/form/index.ts`
- Modify: `apps/workspace/src/lib/api-client.ts`
- Modify: `apps/workspace/src/components/settings/client-form-link-card.tsx`
- Modify: `apps/workspace/src/components/profile/staff-form-link-card.tsx`
- Modify: `apps/workspace/src/routes/team/profile/$staffId.tsx`
- Modify: `apps/workspace/src/components/settings/settings-profile-tab.tsx`
- Modify: `apps/workspace/src/locales/en.json`
- Modify: `apps/workspace/src/locales/vi.json`

## Implementation Steps
1. Add schema field and migration from Phase 01.
2. Add Zod validation for `defaultUploadLinkTemplateId`.
3. Include field in org settings read/write response.
4. In settings card, show selector and save selected id with mutation.
5. Include field in staff profile read/write responses.
6. In staff form link card, show selector and save selected id with mutation.
7. Disable selectors while settings save is pending.
8. In public form route, select default template id with org for generic submissions.
9. In public form route, select staff default template id first for staff-link submissions.
10. Resolve content and pass to `trySendWelcomeSms`.
11. Update `trySendWelcomeSms` signature to accept optional template message.

## Todo List
- [x] API validation.
- [x] API response type.
- [x] Settings UI selector.
- [x] Staff profile UI selector.
- [x] Public form auto-send resolver.

## Success Criteria
- Turning on auto-send and selecting a template affects future form submissions.
- Staff personal form auto-send can use a different template than org generic form.
- Existing orgs without the new field still send with current fallback.
- Existing staff without the new field still fallback to org or current default.

## Risk Assessment
- Risk: changing public form route can affect all self-serve registrations.
- Mitigation: preserve fallback and wrap SMS send in existing try/catch.
- Risk: staff-link behavior becomes ambiguous if staff template is blank.
- Mitigation: explicit precedence `staff default -> org default -> built-in fallback`.

## Security Considerations
- PATCH remains admin-only.
- Staff PATCH for personal default template must require authenticated current staff.
- Public route only reads org setting; no external control over template id.
- Public route reads staff setting only after matching active staff slug within active org.

## Next Steps
- Run migrations/status and verify.

## Unresolved Questions
- None.
