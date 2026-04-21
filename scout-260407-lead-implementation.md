# Scout Report: Lead Page Implementation

**Scope**: Complete lead management system for workspace app  
**Date**: 2026-04-07  
**Status**: Fully scoped and operational

---

## File Inventory

### Frontend Components (apps/workspace/src/)

**Pages**
- /routes/leads/index.tsx - Main leads list page (2 tabs: leads, campaigns)

**Lead Components**
- /components/leads/lead-list-table.tsx - Table with multi-select, status badges
- /components/leads/lead-detail-drawer.tsx - 900px right drawer for details/notes/tags/messages
- /components/leads/convert-lead-dialog.tsx - Modal to convert lead to client
- /components/leads/lead-status-badge.tsx - Color-coded status indicator
- /components/leads/leads-toolbar.tsx - Search, filters, bulk SMS trigger
- /components/leads/bulk-sms-dialog.tsx - Send SMS with {{firstName}}, {{formLink}} placeholders
- /components/leads/lead-list-table-skeleton.tsx - Loading skeleton
- /components/leads/lead-card.tsx - Card component
- /components/leads/lead-form-link-card.tsx - Form link card
- /components/leads/campaigns-tab.tsx - Campaign management tab
- /components/leads/create-campaign-dialog.tsx - Create campaign modal
- /components/leads/edit-campaign-dialog.tsx - Edit campaign modal

**API & Types**
- /lib/api-client.ts - API client with lead endpoints and types

### Backend API (apps/api/src/)

**Routes**
- /routes/leads/index.ts - All lead CRUD, convert, bulk SMS endpoints
- /routes/leads/schemas.ts - Zod validation schemas

**Shared Types (packages/shared/src/)**
- /schemas/index.ts - Shared Zod schemas, leadStatusEnum

---

## Type Definitions

**LeadStatus**: 'NEW' | 'CONTACTED' | 'CONVERTED' | 'LOST'

**Lead Interface**
- id, firstName, lastName, phone, email, businessName
- status: LeadStatus
- campaignTag, campaignName, tags[], notes
- convertedToId, createdAt, smsSendLogs[]

**SmsSendLog**
- id, message, status (SENT|DELIVERED|FAILED|UNDELIVERED), sentAt

---

## API Endpoints

**GET /leads** (Protected)
- Query: page, limit, status, search, tag
- Returns: PaginatedResponse<Lead>

**GET /leads/:id** (Protected)
- Includes: smsSendLogs (last 20), campaignName
- Returns: Lead

**GET /leads/tags** (Protected)
- Returns: string[]

**PATCH /leads/:id** (Protected)
- Body: status, notes, firstName, lastName, email, businessName, tags
- Sanitization: TextInput, tag formatting

**GET /leads/:id/convert-check** (Protected)
- Returns: hasDuplicate, existingClient

**POST /leads/:id/convert** (Protected, Transaction)
- Creates: Client, TaxEngagement, TaxCase
- Sends: Welcome SMS if enabled
- Returns: clientId, engagementId
- Error: 409 on phone duplicate

**POST /leads/bulk-sms** (Protected, Batched by 10)
- Placeholders: {{firstName}}, {{formLink}}
- Creates SmsSendLog, updates NEW->CONTACTED on success
- Returns: sent, failed, errors

**DELETE /leads/:id** (Protected)

**POST /leads** (Public, Rate Limited 5/IP)
- Phone normalization to E.164
- Campaign validation
- Duplicate phone+org handled gracefully

---

## Frontend State

**Lead List**
- activeTab, search (debounced 300ms), statusFilter, tagFilter
- selectedIds Set<string>, selectedLead, convertLead, showBulkSms, page

**React Query Keys**
- ['leads', page, search, statusFilter, tagFilter] - keepPreviousData
- ['lead', id] - 30s staleTime
- ['lead-tags'], ['lead-convert-check', id]
- ['team-members'], ['org-settings']

---

## Convert Modal

**Duplicate Check**: Pre-loads before modal opens, shows yellow warning (soft block), server transactional check (409 hard)

**Flow**
1. Select managedBy staff (optional)
2. Choose language (VI/EN, default VI)
3. Select tax year (current-1, -2, -3)
4. Toggle sendWelcomeSms (default true)
5. Submit: creates Client/TaxEngagement/TaxCase
6. Success: invalidates ['leads'], navigates /clients/$clientId
7. Welcome SMS sent async with magic link

---

## Tag Management

**Validation**: lowercase alphanumeric+hyphens, 100 chars max, 20 tags max

**Sources**: campaign tag (auto), manual tags (drawer)

**Lookup**: GET /leads/tags via SQL UNNEST

**Management**: add (input+button, auto-format), remove (X chip, disabled if CONVERTED), campaign tag read-only

---

## Message History

**Data**: SmsSendLog array in Lead detail (last 20, desc sentAt)

**Status**: SENT (yellow), DELIVERED (green), FAILED (red), UNDELIVERED (red)

**Display**: scrollable (max-h-64), icon + label + timestamp + text, empty state

**Created**: bulk SMS, convert if sendWelcomeSms=true, Schedule C/E send

---

## Status Transitions

**Values**: NEW (blue), CONTACTED (yellow), CONVERTED (green), LOST (gray)

**Allowed**: NEW->CONTACTED/CONVERTED/LOST, CONTACTED->CONVERTED/LOST, LOST->any, CONVERTED->terminal

**CONVERTED Behavior**: checkbox disabled, status hidden, no tag edits, no delete, "View Client" link

---

## Bulk SMS

**Message**: max 160 chars, {{firstName}}, {{formLink}}, live preview

**Form Links**: org=${PORTAL_URL}/form/${orgSlug}, staff=${PORTAL_URL}/form/${orgSlug}/${staffSlug}

**Results**: success (auto-close 2s), partial (counts+errors), error (details with names)

---

## Unresolved Questions

None - implementation complete and operational.
