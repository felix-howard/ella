# Scout Report: Upload Link Message Template Selection

## Scope
User wants upload-link SMS flows to select message template consistently:
- Existing client Files tab `Send Upload Link` modal
- Create Client confirm step already has template cards
- Lead `Convert to Client` modal
- Settings `Form Links` auto-send upload link config

## Current Findings
- `apps/workspace/src/components/clients/client-sms-templates.ts`
  - Defines two hardcoded upload-link templates: `official-channel`, `tax-documents`.
  - Uses placeholders `{{client_name}}`, `{{tax_year}}`, `{{portal_link}}`.
- `apps/workspace/src/components/clients/client-sms-template-selector.tsx`
  - Existing reusable radio-card selector used by create-client confirm step.
- `apps/workspace/src/components/shared/send-upload-link-modal.tsx`
  - Only language toggle + textarea. No template selector.
- `apps/workspace/src/components/leads/convert-lead-dialog.tsx`
  - Only language toggle + textarea. No template selector.
- `apps/workspace/src/components/settings/client-form-link-card.tsx`
  - Only stores `autoSendFormClientUploadLink` boolean.
- `apps/workspace/src/components/profile/staff-form-link-card.tsx`
  - Personal staff form link already has `autoSendUploadLink` toggle.
  - No personal default upload-link template selector.
- `apps/api/src/routes/form/index.ts`
  - Auto-send uses `trySendWelcomeSms(...)` with no configured template.
  - Staff-link submissions prefer `staff.autoSendUploadLink` over org auto-send boolean.
- `apps/api/src/services/sms/message-sender.ts`
  - `customMessage` path supports `{{...}}` placeholders.
  - No-custom path tries DB `MessageTemplate` with `{clientName}` placeholders, then hardcoded fallback.
- `packages/db/prisma/schema.prisma`
  - `Organization.autoSendFormClientUploadLink` exists.
  - No org-level default upload-link template field.
  - `Staff.autoSendUploadLink` exists.
  - No staff-level default upload-link template field.

## Constraints
- Must use Prisma migration, never `prisma db push`.
- Keep behavior backward compatible.
- Do not replace the existing create-client template UX; reuse it.
- Do not depend on global `MessageTemplate` rows for this feature because create-client uses the hardcoded two-template catalog.

## Recommended Approach
- Treat the two create-client upload-link templates as canonical for upload-link sending.
- Add org setting field `defaultUploadLinkTemplateId String?`.
- Add staff setting field `defaultUploadLinkTemplateId String?` for personal form links.
- Add API support to read/write this field through `/org-settings`.
- Add API support to read/write staff default template through `/staff/me/auto-send-upload-link` or a sibling staff settings endpoint.
- In public form auto-send, resolve that id to template content and pass it as `customMessage` to `sendWelcomeMessage`.
- For staff form submissions, use staff default template first, then org default template, then fallback.
- In staff/client manual sends and convert-lead, use existing selector and send chosen template content as current custom message.

## Unresolved Questions
- None. User confirmed personal staff form auto-send needs its own default template.
