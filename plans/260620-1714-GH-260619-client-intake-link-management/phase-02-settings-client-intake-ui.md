# Phase 02 - Settings Client Intake UI

## Context Links
- [settings route](../../apps/workspace/src/routes/settings.tsx)
- [organization tab](../../apps/workspace/src/components/settings/settings-organization-tab.tsx)
- [form links tab](../../apps/workspace/src/components/settings/settings-form-links-tab.tsx)
- [org slug editor](../../apps/workspace/src/components/settings/org-slug-editor.tsx)
- [client form link card](../../apps/workspace/src/components/settings/client-form-link-card.tsx)
- [SMS template selector](../../apps/workspace/src/components/clients/client-sms-template-selector.tsx)
- [SMS templates](../../apps/workspace/src/components/clients/client-sms-templates.ts)
- [design guidelines](../../docs/design-guidelines.md)

## Overview
- Priority: high
- Status: pending
- Description: replace fragmented form-link settings with one `Client Intake` management section.

## Key Insights
- Current organization tab nests `OrgSlugEditor` and `ClientFormLinkCard` after firm info.
- Current UI separates org slug, generic intake link, and staff personal link configuration.
- Settings page currently uses `max-w-3xl`; the intake links table may need wider content.
- UI must stay operational, dense, and consistent with existing card/sidebar style.

## Requirements
- Create one canonical section: `Client Intake`.
- Include:
  - Organization URL slug
  - Default upload-link message settings
  - Intake links table
- General link row:
  - Name: `General Intake`
  - Assignment: `Unassigned`
  - URL: `/form/{orgSlug}`
  - Upload message settings from org defaults
- Staff rows:
  - Name: `{staff.name} Intake`
  - Assignment: staff name
  - URL: `/form/{orgSlug}/{staff.formSlug}`
  - Upload message: `Use organization default` or custom summary
- Language selector must only have:
  - `English US`
  - `Vietnamese`
- No `Auto` language option.
- Template area must be disabled/collapsed when auto-send is off, or clearly marked as used only when enabled.

## Architecture
- Recommended components:
  - `settings-form-links-tab.tsx` becomes a thin wrapper for the new Client Intake section.
  - Keep `org-slug-editor.tsx` but relabel as Organization URL slug, or fold it into the new section if file size stays under 200 lines.
  - Replace `client-form-link-card.tsx` with a broader client intake management card or split into focused components.
  - Add small focused components if needed:
    - `intake-link-table.tsx`
    - `intake-link-settings-drawer.tsx`
    - `upload-link-message-settings.tsx`
- Query model:
  - `['org-settings']` for org settings.
  - `['org-intake-links']` for `GET /org-settings/intake-links`.
  - Invalidate both after slug/default/staff link updates.
- UX model:
  - Top card: org slug + warning that changing slug affects all public links.
  - Middle card: default follow-up settings.
  - Bottom card/table: general + staff intake links.
  - Edit actions open drawer/modal, not inline sprawling controls.

## Related Code Files
- Modify:
  - `apps/workspace/src/routes/settings.tsx`
  - `apps/workspace/src/components/settings/settings-organization-tab.tsx`
  - `apps/workspace/src/components/settings/settings-form-links-tab.tsx`
  - `apps/workspace/src/components/settings/org-slug-editor.tsx`
  - `apps/workspace/src/components/settings/client-form-link-card.tsx`
  - `apps/workspace/src/components/clients/client-sms-template-selector.tsx` if it needs explicit language labels
  - `apps/workspace/src/lib/api-client.ts`
  - `apps/workspace/src/locales/en.json`
  - `apps/workspace/src/locales/vi.json`
- Create only if needed for file size:
  - focused settings components under `apps/workspace/src/components/settings/`

## Implementation Steps
1. Update Settings route focus support:
   - Add valid focus `client-intake`.
   - Keep legacy `tab=form-links` normalization to organization.
2. Consider widening Settings page organization content to `max-w-5xl` while keeping account layout readable.
3. Rename visible copy:
   - `Organization Slug` -> `Organization URL slug`
   - `Client Intake Form` -> `General Intake Link`
   - `Auto-send Upload Link` -> `Send document upload link after intake`
   - `Message template` -> `Upload link message`
4. Build the `Client Intake` section:
   - concise section title + scope description
   - slug editor
   - default follow-up settings
   - intake links table
5. Build language selector as a segmented control or radio group with exactly `English US` and `Vietnamese`.
6. Build template selector preview using existing `ClientSmsTemplateSelector` and current template data.
7. Build staff link edit drawer/modal:
   - slug field
   - `Use organization default` toggle/radio
   - custom settings when not inheriting
   - save/cancel
   - slug change warning
8. Add copy buttons for every row.
9. Disable edit actions for users without `canManageClients` or equivalent capability.
10. Ensure loading, empty, error, and no-org-slug states are clear.

## Todo List
- [ ] Settings focus updated
- [ ] Client Intake section added
- [ ] Org slug copy relabeled
- [ ] Default upload message controls added
- [ ] Intake links table added
- [ ] Staff link edit drawer/modal added
- [ ] Copy actions added
- [ ] Permission gating added

## Success Criteria
- A user can manage the general link and all staff links from Settings.
- The Settings page clearly shows assignment and follow-up behavior for each link.
- No upload-link language option says `Auto`.
- Staff profile is no longer needed to configure form links.

## Risk Assessment
- Table can become cramped on smaller widths. Use stacked row layout below tablet widths.
- Too many controls inside a table row will feel crowded. Use drawer/modal for edits.
- If the Settings page stays `max-w-3xl`, staff link table may truncate too much.

## Security Considerations
- UI must not show editable controls when API would reject them.
- Copy buttons must copy only public form URLs, never magic links or tokens.

## Next Steps
- Phase 03 removes Team Profile form-link tab and adds the read-only Overview card.

## Unresolved Questions
- None.
