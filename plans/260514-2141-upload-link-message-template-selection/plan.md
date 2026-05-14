# Upload Link Message Template Selection Plan

## Goal
Unify upload-link SMS template selection across manual sends, lead conversion, org form auto-send, and personal staff form auto-send.

## Current Status
- Complete. Implemented, migrated, type-checked, tested, reviewed, docs updated.
- README, root `AGENTS.md`, code standards, design guidelines, and relevant files were reviewed.
- User confirmed personal staff form auto-send must have its own default template.

## Key Dependencies
- Existing hardcoded template catalog: `apps/workspace/src/components/clients/client-sms-templates.ts`
- Existing selector UI: `apps/workspace/src/components/clients/client-sms-template-selector.tsx`
- Upload SMS backend: `apps/api/src/services/sms/message-sender.ts`
- Org settings API: `apps/api/src/routes/org-settings/index.ts`
- Staff settings API: `apps/api/src/routes/staff/index.ts`
- Public form auto-send: `apps/api/src/routes/form/index.ts`

## Phases
- [x] [Phase 01: Shared Template Contract](phase-01-shared-template-contract.md)
- [x] [Phase 02: Manual Send UI](phase-02-manual-send-ui.md)
- [x] [Phase 03: Auto-Send Default Template Setting](phase-03-auto-send-default-template-setting.md)
- [x] [Phase 04: Verification And Docs](phase-04-verification-and-docs.md)

## Implementation Notes
- Use `prisma migrate dev --name add-default-upload-link-template` for schema change.
- Do not use `prisma db push`.
- Keep placeholders compatible with manual custom-message path: `{{client_name}}`, `{{tax_year}}`, `{{portal_link}}`.
- Preserve fallback behavior when no default template is configured.
- Public staff form submissions should use staff default template first, then org default template, then fallback.

## Success Criteria
- Existing client `Send Upload Link` modal shows same template cards as create-client.
- `Convert to Client` modal shows same template cards.
- Settings Form Links auto-send can choose default template and persists it.
- Personal staff form auto-send can choose default template and persists it.
- Public self-serve form auto-send sends configured default template.
- Public staff-link form auto-send sends staff configured default template when present.
- Type-check/build passes for changed packages.
- Focused form auto-send tests cover no-default fallback, org default, and staff-over-org precedence.

## Unresolved Questions
- None.
