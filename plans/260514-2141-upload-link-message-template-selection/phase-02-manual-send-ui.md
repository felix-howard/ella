# Phase 02: Manual Send UI

## Context Links
- `apps/workspace/src/components/clients/client-sms-template-selector.tsx`
- `apps/workspace/src/components/shared/send-upload-link-modal.tsx`
- `apps/workspace/src/components/leads/convert-lead-dialog.tsx`
- `apps/workspace/src/routes/clients/$clientId.tsx`

## Overview
- Priority: High
- Status: Complete
- Add template cards to manual send flows while preserving editable textarea.

## Key Insights
- `ClientSmsTemplateSelector` already matches desired screenshot.
- Manual send endpoint already accepts `customMessage`.
- Convert lead endpoint already receives `customMessage`.

## Requirements
- Functional: modal in Files tab shows selectable template cards.
- Functional: convert-lead modal shows selectable template cards.
- Functional: switching language updates message only if current message still matches selected template, to avoid overwriting edits.
- Non-functional: keep buttons/loading/disabled states unchanged.

## Architecture
- UI state keeps selected template id and per-language message values.
- `onSend(currentMessage)` remains unchanged.
- Convert-lead sends `customMessage` as before.

## Related Code Files
- Modify: `apps/workspace/src/components/shared/send-upload-link-modal.tsx`
- Modify: `apps/workspace/src/components/leads/convert-lead-dialog.tsx`
- Modify: `apps/workspace/src/components/clients/client-sms-template-selector.tsx` only if prop flexibility needed.
- Modify: `apps/workspace/src/locales/en.json`
- Modify: `apps/workspace/src/locales/vi.json`

## Implementation Steps
1. Import `ClientSmsTemplateSelector`, ids, and `getClientSmsTemplate`.
2. Replace hardcoded upload modal templates with canonical client SMS templates.
3. Add selected template id state to upload modal reset flow.
4. Add selector above textarea in upload modal.
5. Add selected template id state to convert-lead dialog.
6. Add selector above textarea in convert-lead SMS panel.
7. Ensure textarea still supports edits after selecting a template.

## Todo List
- [x] Files-tab modal selector.
- [x] Convert-lead selector.
- [x] Locale cleanup if labels are missing.

## Success Criteria
- Both modals visually match create-client selector pattern.
- Sending still sends the edited message content.

## Risk Assessment
- Risk: switching language overwrites custom edits.
- Mitigation: only reset message when it matches the previous selected template.

## Security Considerations
- No new security surface; custom SMS body already supported.

## Next Steps
- Wire settings default template.

## Unresolved Questions
- None.
