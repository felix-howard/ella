# Campaign System - Complete File Map

## Overview
Comprehensive map of all campaign-related files in the codebase, including Prisma schema, API routes, types, and frontend components.

---

## 1. DATABASE SCHEMA

### File: `packages/db/prisma/schema.prisma`

**Campaign Model Definition:**
```prisma
model Campaign {
  id             String         @id @default(cuid())
  name           String
  slug           String
  status         CampaignStatus @default(ACTIVE)
  description    String?        @db.Text

  // Relations
  organizationId String
  organization   Organization   @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  createdById    String
  createdBy      Staff          @relation("CreatedCampaigns", fields: [createdById], references: [id])

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt

  @@unique([slug, organizationId])
  @@index([organizationId, status])
}

enum CampaignStatus {
  ACTIVE
  ARCHIVED
}
```

**Key Points:**
- Unique constraint on (slug, organizationId) - slugs are org-scoped
- Linked to Organization (cascading delete)
- Linked to Staff (who created it) via createdBy relationship
- Two-field index for efficient querying by organization and status

---

## 2. BACKEND API

### File: `apps/api/src/routes/campaigns/index.ts`

**Endpoints:**

1. **GET /campaigns** - List all campaigns (requires org admin)
   - Returns: campaigns with lead count aggregated from leads by campaignTag
   - Orders by: status ASC, createdAt DESC
   - Includes: creator name

2. **POST /campaigns** - Create new campaign (requires org admin)
   - Body: `{ name: string, slug: string, description?: string }`
   - Returns: created campaign with lead count = 0

3. **PATCH /campaigns/:id** - Update campaign (requires org admin)
   - Body: `{ name?: string, description?: string | null, status?: 'ACTIVE' | 'ARCHIVED' }`
   - Slug is immutable (not updatable)
   - Returns: updated campaign

4. **DELETE /campaigns/:id** - Delete campaign (requires org admin)
   - Constraint: Only deletable if campaignTag count = 0
   - Returns: 409 error if leads exist
   - Uses transaction to prevent race conditions

**Middleware:**
- `authMiddleware` - Verifies user is authenticated
- `requireOrgAdmin` - Verifies user is org admin

### File: `apps/api/src/routes/campaigns/schemas.ts`

**Zod Validation Schemas:**

```typescript
createCampaignSchema = {
  name: string (1-100 chars)
  slug: string (regex: /^[a-z0-9-]+$/, 1-50 chars)
  description?: string (max 500 chars)
}

updateCampaignSchema = {
  name?: string (1-100 chars)
  description?: string | null (max 500 chars)
  status?: 'ACTIVE' | 'ARCHIVED'
}

campaignIdParamSchema = {
  id: string (CUID format)
}
```

---

## 3. FRONTEND TYPES & API CLIENT

### File: `apps/workspace/src/lib/api-client.ts`

**Types:**

```typescript
export type CampaignStatus = 'ACTIVE' | 'ARCHIVED'

export interface Campaign {
  id: string
  name: string
  slug: string
  status: CampaignStatus
  description: string | null
  createdById: string
  createdBy: { name: string }
  createdAt: string
  updatedAt: string
  _count: { leads: number }
}
```

**API Methods (inferred from usage):**
- `api.campaigns.list()` - GET /campaigns
- `api.campaigns.create(data)` - POST /campaigns
- `api.campaigns.update(id, data)` - PATCH /campaigns/:id
- `api.campaigns.delete(id)` - DELETE /campaigns/:id

---

## 4. FRONTEND COMPONENTS

### File: `apps/workspace/src/components/leads/campaigns-tab.tsx`

**Main campaign list & management component**

**Key Features:**
- Renders list of campaigns as cards (grid: 1 col mobile, 2 cols desktop)
- Displays campaign status (ACTIVE/ARCHIVED) with visual badges
- Shows registration URL (format: `{PORTAL_BASE_URL}/register/{orgSlug}/{campaign.slug}`)
- Copy-to-clipboard functionality for registration URLs
- Lead count per campaign (clickable to filter leads)
- CRUD actions: Edit, Archive/Activate, Delete

**Subcomponent: CampaignCard**
- Displays: name, status, registration URL, description, lead count, creator name
- Actions:
  - Copy registration URL (shows check icon on copy)
  - View leads button (filters to that campaign)
  - Archive/Unarchive toggle
  - Edit button (opens EditCampaignDialog)
  - Delete button (only if leads count = 0)

**Hooks:**
- `useQuery(['campaigns'], api.campaigns.list)` - Fetch campaigns
- `useMutation(api.campaigns.update)` - Update campaign
- `useMutation(api.campaigns.delete)` - Delete campaign
- `useTranslation()` - i18n support (Vietnamese/English)

### File: `apps/workspace/src/components/leads/create-campaign-dialog.tsx`

**Modal form for creating new campaigns**

**Features:**
- Auto-slug generation from name (converts to lowercase, strips special chars)
- Manual slug override (slug auto-update stops once user edits)
- Slug validation (regex: `^[a-z0-9-]+$`)
- URL preview showing final registration link
- Description field (optional, 500 char limit)
- Name field (required, 100 char limit)

**Validation:**
- Name must be 1+ chars
- Slug must match `^[a-z0-9-]+$` and be 1+ chars
- Handles 409 slug conflict error

**Behavior:**
- Closes on success
- Shows loading state during submission
- Invalidates campaigns query on success

### File: `apps/workspace/src/components/leads/edit-campaign-dialog.tsx`

**Modal form for editing existing campaigns**

**Editable Fields:**
- name (required, 100 char limit)
- description (optional, 500 char limit)

**Read-only Field:**
- slug (shown as disabled input to prevent accidental changes)

**Behavior:**
- Slug is intentionally immutable (affects lead tracking)
- Status changes handled separately in CampaignsTab (archive/unarchive buttons)
- Invalidates campaigns query on success

---

## 5. INTEGRATION POINTS

### Lead Integration
- Leads are tagged with `campaignTag` field (maps to Campaign.slug)
- When filtering leads, campaigns-tab calls `onViewLeads(campaign.slug)`
- Campaign deletion blocked if `Lead.count({ campaignTag: campaign.slug }) > 0`

### Portal Integration
- Registration URLs point to: `{PORTAL_BASE_URL}/register/{orgSlug}/{campaign.slug}`
- Portal should use slug to tag incoming leads with campaign

### Localization
- All UI strings use i18n keys (Vietnamese/English)
- Keys referenced:
  - `leads.createCampaign`, `leads.editCampaign`, `leads.campaignCreated`, etc.
  - All stored in `apps/workspace/src/locales/{en,vi}.json`

---

## 6. UNRESOLVED QUESTIONS

- Does the portal actually use `orgSlug` + `campaign.slug` to tag leads during signup?
- Are there any validation rules on campaign slug uniqueness beyond (slug, orgId)?
- Is there campaign analytics/reporting elsewhere?
