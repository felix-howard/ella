# Phase 03 - Team Profile Overview Shortcut

## Context Links
- [team profile route](../../apps/workspace/src/routes/team/profile/$staffId.tsx)
- [profile tabs](../../apps/workspace/src/components/profile/staff-profile-tabs.tsx)
- [current staff form link card](../../apps/workspace/src/components/profile/staff-form-link-card.tsx)
- [assigned clients list](../../apps/workspace/src/components/profile/assigned-clients-list.tsx)

## Overview
- Priority: high
- Status: complete
- Description: remove the dedicated `Form Link` tab and show personal intake link as a compact read-only Overview section.

## Key Insights
- Current `StaffProfileTabs` always exposes a `form-link` tab.
- Current `StaffFormLinkCard` includes slug editing and, for own profile, upload-link automation controls.
- New design makes Settings the only configuration surface.
- Team Profile still needs quick copy because users naturally look at a team member profile for that member's link.

## Requirements
- Remove `Form Link` tab trigger.
- Remove `form-link` tab content.
- Add a compact Overview card:
  - title: `Personal Intake Link`
  - assignment explanation: new clients from this link are assigned to the displayed staff member
  - URL display + copy action
  - `Manage in Settings` action for admins/managers
- The Overview card must be read-only. No slug edit. No automation toggle. No template selector.
- If org slug or staff slug is missing, show setup state and `Manage in Settings` for users with permission.
- Keep documents/invoices tabs unchanged.

## Architecture
- Replace `StaffFormLinkCard` with a read-only component, or refactor it heavily:
  - suggested name: `staff-personal-intake-link-card.tsx`
  - props: `staffName`, `formSlug`, `orgSlug`, `canManageIntakeLinks`
  - no mutations except clipboard copy
- Add the card in Overview right column, near `AssignedClientsList`.
- Link `Manage in Settings` to:
  - `/settings?tab=organization&focus=client-intake`
- `StaffProfileTabs` active tab logic must no longer include `form-link`.

## Related Code Files
- Modify:
  - `apps/workspace/src/components/profile/staff-profile-tabs.tsx`
  - `apps/workspace/src/components/profile/staff-form-link-card.tsx` or replace with a read-only component
  - `apps/workspace/src/routes/team/profile/$staffId.tsx` if prop names need cleanup
  - `apps/workspace/src/locales/en.json`
  - `apps/workspace/src/locales/vi.json`
  - profile tests listed in Phase 04
- Remove only if unused after refactor:
  - old editable code paths in `staff-form-link-card.tsx`

## Implementation Steps
1. Remove `Link2` tab trigger and `form-link` tab content from `StaffProfileTabs`.
2. Remove `form-link` from `activeTabAvailable`.
3. Add read-only personal intake link card to Overview.
4. Build URL with `PORTAL_BASE_URL`, `orgSlug`, and staff `formSlug`.
5. Add copy behavior using existing clipboard/toast pattern.
6. Add `Manage in Settings` CTA when `canManageTeam` or `canManageClients` is true.
7. Remove profile-side mutations:
   - `api.staff.updateFormSlug`
   - `api.staff.updateAutoSendUploadLink`
   from the profile component path.
8. Keep API client methods until Phase 04 confirms no remaining callers, then remove unused methods if safe.

## Todo List
- [x] Form Link tab removed
- [x] Overview read-only card added
- [x] Copy action works
- [x] Manage in Settings link added
- [x] Missing slug state added
- [x] Profile-side editable mutations removed

## Validation
- `pnpm -F @ella/workspace test -- profile-tabs` passed, 11 tests.
- `pnpm -F @ella/workspace type-check` passed.
- `pnpm -F @ella/workspace lint` failed on pre-existing Phase 02 lint error in `apps/workspace/src/components/settings/intake-link-settings-modal.tsx` (`react-hooks/set-state-in-effect`); no Phase 03 lint errors reported.

## Success Criteria
- Team profile has Overview, Documents, and Invoices tabs only when applicable.
- Personal intake link is visible in Overview.
- Users cannot configure slug/template/toggle from Team Profile.
- Admins/managers have a clear path back to Settings.

## Risk Assessment
- Some users may miss the old tab. The Overview card must be visible enough.
- If profile route cannot access `orgSettings.slug`, the card must handle loading/null state without layout shift.

## Security Considerations
- Read-only profile card can be visible where profile itself is visible.
- Manage CTA visibility must match actual API permissions.

## Next Steps
- Phase 04 updates tests and translations.

## Unresolved Questions
- None.
