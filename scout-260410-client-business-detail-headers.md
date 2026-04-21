# Scout Report: Client/Business Detail Page Headers

Date: 2026-04-10
Scope: Header and detail page components for client and business records

## MAIN HEADER COMPONENT
File: /c/Users/Admin/Desktop/ella/apps/workspace/src/routes/clients/$clientId.tsx
Lines: 557-771 (main header section)
Purpose: Renders client/business detail page header with tabs

## CORE HEADER ELEMENTS
- Avatar (rounded-lg for BUSINESS, rounded-full for INDIVIDUAL)
- Client name + Business type badge (if business)
- Phone number (formatted/masked based on admin role)
- Email address
- EIN (masked: ***-**-{last4}, business only)
- Year switcher (for multi-year engagements)
- Managed by staff name
- Linked entity chips (individual shows businesses, business shows owner)
- Tags
- Status buttons (Send to Review, Mark Filed, Reopen)
- Upload Link button
- Messages button with unread badge
- Tab navigation (Overview, Files, Checklist, Data Entry, Draft Return)

## OVERVIEW TAB SUB-COMPONENTS
1. client-profile-card.tsx - Name/contact with inline edit
2. client-linked-entity-card.tsx - Show linked businesses or owner
3. client-meta-info.tsx - Audit metadata
4. client-quick-stats.tsx - 4-card stats grid
5. client-activity-timeline.tsx - Activity feed
6. client-assigned-staff.tsx - Staff assignment
7. client-notes-editor.tsx - Rich text notes
8. client-avatar-uploader.tsx - Avatar upload

## BUSINESS-SPECIFIC COMPONENTS

### Business Accordion
File: /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/business-accordion.tsx
Purpose: Manage multiple businesses in creation wizard
- Accordion expand/collapse per business
- Add business button (max 10)
- Remove business button
- Inline business form
- Business type badge

### Business Info Form
File: /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/business-info-form.tsx
Purpose: Form for business details
Fields: name, EIN, businessType (SOLE_PROPRIETORSHIP, LLC, PARTNERSHIP, S_CORP, C_CORP)

### Add Business Drawer
File: /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/add-business-drawer.tsx
Purpose: Modal for adding linked business to individual

## CLIENT LINKED ENTITY CARD LOGIC

For INDIVIDUAL clients:
- Shows empty state with "Add Business" button if no businesses
- Shows list of linked businesses with click-through navigation
- Can add/remove businesses

For BUSINESS clients:
- Shows owner (linked individual) with details
- Phone, email, EIN displayed
- Click through to owner's detail page
- Hidden if no linked owner

## ALL RELATED FILES

Routes:
1. /c/Users/Admin/Desktop/ella/apps/workspace/src/routes/clients/$clientId.tsx

Overview Tab:
2. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/index.tsx
3. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-profile-card.tsx
4. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-linked-entity-card.tsx
5. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-meta-info.tsx
6. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-quick-stats.tsx
7. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-activity-timeline.tsx
8. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-assigned-staff.tsx
9. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-notes-editor.tsx
10. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/client-avatar-uploader.tsx

Business Components:
11. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/business-accordion.tsx
12. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/business-info-form.tsx
13. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-tab/add-business-drawer.tsx

Supporting:
14. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-type-selector.tsx
15. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/year-switcher.tsx
16. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/create-engagement-modal.tsx
17. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-card.tsx
18. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-list-table.tsx
19. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/basic-info-form.tsx
20. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/action-badge.tsx
21. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/computed-status-badge.tsx
22. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/address-autocomplete.tsx

Wizard/Intake:
23. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-wizard/
24. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-questions-form.tsx
25. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/multi-section-intake-form.tsx
26. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/dynamic-intake-form.tsx
27. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-repeater.tsx
28. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-section.tsx
29. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-question.tsx
30. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/intake-progress.tsx
31. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/returning-client-section.tsx
32. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/confirm-step.tsx
33. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/save-indicator.tsx
34. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/index.ts
35. /c/Users/Admin/Desktop/ella/apps/workspace/src/components/clients/client-overview-sections.tsx

## KEY CONSTANTS IN $clientId.tsx

BUSINESS_TYPE_LABELS:
  SOLE_PROPRIETORSHIP: 'Sole Prop'
  LLC: 'LLC'
  PARTNERSHIP: 'Partnership'
  S_CORP: 'S-Corp'
  C_CORP: 'C-Corp'

## IMPORTANT ARCHITECTURAL NOTES

- No separate business detail page exists
- Both individual and business clients use same $clientId.tsx route
- Avatar styling differs: BUSINESS = rounded-lg, INDIVIDUAL = rounded-full
- Business clients show EIN masked: ***-**-{last4}
- Business clients show "Contractors" tab (individuals do not)
- Individual clients show "Schedule E" tab (businesses do not)
- Business clients can have linked owner (individual)
- Individual clients can have multiple linked businesses
- Upload Link button redirects to owner's portal for business clients
- Messages button redirects to owner's conversation for business clients
- Year Switcher manages multi-year engagement selection
- Tab switching invalidates queries for docs/images/checklist when year changes

## UNRESOLVED QUESTIONS

- Does the "Contractors" tab have its own component file? (Referenced as lazy-loaded but location unclear)
- Are there any other business-specific UI elements beyond the tabs and header changes?

## RESOLVED: Contractors Tab

The "Contractors" tab (shown only for business clients) is actually an alias for the Form1099NECTab component:

File: /c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab.tsx
Location in $clientId.tsx: Line 967-973
Props: clientId, clientName

The "Contractors" tab label maps to 1099-NEC form handling for contractor/business income reporting. This is business-specific because 1099-NECs are used to report contractor payments.

Related contractor components:
- /c/Users/Admin/Desktop/ella/apps/workspace/src/components/cases/tabs/form-1099-nec-tab/contractor-review-table.tsx
