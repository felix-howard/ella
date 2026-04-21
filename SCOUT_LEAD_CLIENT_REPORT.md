# Scout Report: Lead & Client Models, Campaign Tags, and Form Creation

Date: 2026-03-30
Scope: Prisma schema, registration/intake flows, form-links, list pages, API endpoints

## 1. PRISMA SCHEMA MODELS

### Lead Model (packages/db/prisma/schema.prisma)
- id: CUID primary key
- firstName, lastName: Required strings  
- phone: Required, normalized to E.164
- email: Optional
- businessName: Optional
- status: LeadStatus enum (NEW, CONTACTED, CONVERTED)
- source: Optional string - stores campaign tag (eventSlug)
- notes: Optional text
- organizationId: Required foreign key
- convertedToId: FK to Client when converted
- convertedAt: Conversion timestamp
- Constraint: Unique on (phone, organizationId)

### Client Model (packages/db/prisma/schema.prisma)
- id: CUID primary key
- firstName: Required (default "")
- lastName: Optional
- name: Computed full name
- phone: Required, globally unique
- email: Optional
- language: VI or EN (default VI)
- source: MANUAL or FORM (creation method)
- avatarUrl: Optional R2 URL
- notes: Optional rich text
- organizationId: Optional FK
- managedById: Optional FK to Staff
- createdById, updatedById: Audit fields
- Constraint: Unique on phone (globally)

NOTE: Client.source indicates creation method, not campaign. To track campaign origin, query the Lead that converted to this Client.

## 2. CAMPAIGN TAG FEATURE

- Display: "Campaign Tag" in UI
- Internal: eventSlug in code
- Storage: Lead.source field
- Format: lowercase alphanumeric + hyphens (max 50 chars)
- Validation: /^[a-z0-9-]*$/
- Component: LeadFormLinkCard (apps/workspace/src/components/leads/lead-form-link-card.tsx)

URLs:
- Base: /register/{orgSlug}
- Campaign: /register/{orgSlug}/{eventSlug}

## 3. LEAD CREATION FROM REGISTRATION FORM

### Portal Routes
- Generic: /register/:orgSlug (source = null)
  File: apps/portal/src/routes/register/$orgSlug/index.tsx
- Campaign: /register/:orgSlug/:eventSlug (source = eventSlug)
  File: apps/portal/src/routes/register/$orgSlug/$eventSlug/index.tsx

### Registration Form
- File: apps/portal/src/components/register/registration-form.tsx
- Fields: firstName (req), lastName (req), phone (req, 10 digits), email (opt), businessName (opt)
- Phone formatting: (XXX) XXX-XXXX

### API: POST /leads/
- File: apps/api/src/routes/leads/index.ts
- Rate limit: 5/min per IP
- Public (no auth)
- Sanitizes inputs, normalizes phone to E.164
- Creates Lead: status=NEW, source=eventSlug||null
- Handles duplicate (phone, organizationId) constraint

## 4. CLIENT CREATION FROM INTAKE FORM

### Portal Routes
- Generic: /form/:orgSlug (managedById = null)
  File: apps/portal/src/routes/form/$orgSlug/index.tsx
- Staff: /form/:orgSlug/:staffSlug (managedById = staff.id)
  File: apps/portal/src/routes/form/$orgSlug/$staffSlug/index.tsx

### Intake Form
- File: apps/portal/src/components/form/intake-form.tsx
- Required: firstName, lastName, phone, taxYear, language
- Optional: Dynamic intake questions

### API: POST /form/:orgSlug/submit
- File: apps/api/src/routes/form/index.ts
- Rate limit: 10/min
- Public (no auth)
- Creates in transaction: Client, TaxEngagement, TaxCase, Conversation
- Client.source = 'FORM', managedById = staff.id (if staff form)
- If autoSendUploadLink enabled: creates MagicLink + sends welcome SMS
- Handles phone uniqueness (409 PHONE_ALREADY_REGISTERED)

## 5. LEAD TO CLIENT CONVERSION

### API: POST /leads/:id/convert
- File: apps/api/src/routes/leads/index.ts
- Protected: org admin only
- Request: managedById, language, taxYear, sendWelcomeSms, customMessage
- Creates Client + TaxEngagement + TaxCase
- Updates Lead: status=CONVERTED, convertedToId, convertedAt
- If sendWelcomeSms: creates MagicLink + sends SMS with custom message

## 6. LEAD LIST PAGE

- Route: apps/workspace/src/routes/leads/index.tsx
- Filters: Search (debounced 300ms), Status (NEW|CONTACTED|CONVERTED), Pagination (20/page)
- Columns: Checkbox, Name+Email, Phone, Status, Source (campaign tag), Business, Created, Actions

### Lead List API: GET /leads/
- Protected: org admin
- Query: page, limit, search, status

## 7. CLIENT LIST PAGE

- Route: apps/workspace/src/routes/clients/index.tsx
- Filters: Search (debounced 300ms), Managed By (admin), Attention (newUploads|needsVerification|stale|readyForEntry), Pagination (100/page)
- Response includes: computed status, action counts, upload stats, hasUploadLink, latest case

### Client.source Values
- MANUAL: Created directly by staff
- FORM: Created via intake form (generic or staff-assigned)

## 8. SETTINGS FORM-LINKS TAB

Location: apps/workspace/src/routes/settings.tsx
Component: apps/workspace/src/components/settings/settings-form-links-tab.tsx

### Sub-Components:
1. OrgSlugEditor - Set organization slug

2. LeadFormLinkCard (apps/workspace/src/components/leads/lead-form-link-card.tsx)
   - Shows: /register/{orgSlug}
   - Campaign tag input field
   - Generates: /register/{orgSlug}/{eventSlug}
   - Copy buttons, client-side validation only

3. StaffFormLinkCard (apps/workspace/src/components/profile/staff-form-link-card.tsx)
   - Shows: /form/{orgSlug}/{staffSlug}
   - Edit formSlug button (own profile only)
   - auto-send upload link toggle
   - API: PATCH /staff/me

4. ClientFormLinkCard (apps/workspace/src/components/settings/client-form-link-card.tsx)
   - Shows: /form/{orgSlug}
   - Global auto-send toggle
   - Applies to generic intake form
   - API: PATCH /org-settings

## 9. AUTO-SEND CONFIGURATION

### Organization Level
- Field: Organization.autoSendFormClientUploadLink
- API: PATCH /org-settings
- Applies to: Generic intake form (/form/{orgSlug})

### Staff Level
- Field: Staff.autoSendUploadLink
- API: PATCH /staff/me
- Applies to: Staff personal form (/form/{orgSlug}/{staffSlug})
- Precedence: Takes priority over org setting

## 10. CRITICAL FILE PATHS

Schema & API:
- packages/db/prisma/schema.prisma
- apps/api/src/routes/leads/index.ts
- apps/api/src/routes/clients/index.ts
- apps/api/src/routes/form/index.ts

Pages:
- apps/workspace/src/routes/leads/index.tsx
- apps/workspace/src/routes/clients/index.tsx
- apps/workspace/src/routes/settings.tsx

Lead Components:
- apps/workspace/src/components/leads/lead-list-table.tsx
- apps/workspace/src/components/leads/lead-form-link-card.tsx
- apps/portal/src/components/register/registration-form.tsx
- apps/portal/src/routes/register/

Client Components:
- apps/workspace/src/components/clients/client-list-table.tsx
- apps/portal/src/components/form/intake-form.tsx
- apps/portal/src/routes/form/

Settings:
- apps/workspace/src/components/settings/settings-form-links-tab.tsx
- apps/workspace/src/components/leads/lead-form-link-card.tsx
- apps/workspace/src/components/profile/staff-form-link-card.tsx
- apps/workspace/src/components/settings/client-form-link-card.tsx

---

## KEY INSIGHTS

1. Campaign tags stored in Lead.source as plain string, not enum
2. Lead-to-client conversion always sets Client.source='FORM' (misleading semantic)
3. Phone globally unique on Client but scoped on Lead
4. Auto-send has org and staff level controls with staff precedence
5. To track campaign origin of a client, query the Lead it converted from
6. No direct campaign tracking field on Client model
7. Form APIs are public with rate limiting
8. Registration form posts to /leads/, intake form posts to /form/:slug/submit
9. Both forms can work with eventSlug/staffSlug for personalization
10. Campaign tag input is client-side validated only (no API validation)
