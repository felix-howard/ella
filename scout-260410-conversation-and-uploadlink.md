# Scout Report: Conversation Creation & Upload Link Features

**Generated**: 2026-04-10
**Focus**: Conversation creation logic, upload link feature, portal link generation

## 1. CONVERSATION CREATION LOGIC

### Overview
- Conversations are created per TaxCase (one-to-one mapping via unique caseId)
- Key Principle: Only INDIVIDUAL clients get conversations
- Business clients: Do NOT get conversations when linked to individual in client group
- Reason: Business filing managed through individual conversation; SMS/messages route through individual

### Creation Points

#### A. Single Client Creation (POST /form)
File: apps/api/src/routes/form/index.ts (lines 170-214)

INDIVIDUAL path (line 180):
  - Creates conversation immediately with lastMessageAt set to avoid race conditions

BUSINESS path (line 208):
  - Creates conversation for business-only clients (edge case - no greeting template)
  - No SMS sent in this path

INDIVIDUAL_WITH_BUSINESS path (lines 220-259):
  - Creates conversation for individual (line 236)
  - Skips conversation for business (comment: "Skip conversation for business — individual already has one")
  - Only individual receives welcome SMS

#### B. Bulk Client Creation (POST /clients/create-with-business)
File: apps/api/src/routes/clients/index.ts (lines 1518-1723)

Individual client: Creates conversation (line 1581)
Business clients: Skips conversation creation (comment at line 1633)

#### C. Link Business to Existing Individual (POST /clients/:id/link-business)
File: apps/api/src/routes/clients/index.ts (lines 1728+)

- Creates new business client with tax case
- Does not create conversation for the business

### Conversation Query (List View)
File: apps/api/src/routes/messages/index.ts (lines 66-126)

- Lists conversations for unified inbox view
- Includes client info: clientType, clientGroupId, clientGroup.name
- Filters through taxCase -> client relationship for org scoping
- Shows last message and unread count per conversation

---

## 2. UPLOAD LINK FEATURE

### Overview
- Upload link = Magic link (PORTAL type) sent via SMS
- Portal URL format: https://portal.ellatax.com/u/{token}
- Key Logic: When sending to BUSINESS client with group, SMS goes to INDIVIDUAL phone

### Send Upload Link Endpoint
File: apps/api/src/routes/clients/index.ts (lines 1414-1513)
Route: POST /clients/:id/send-upload-link

Flow:
1. Find client and latest tax case
2. Business client in group -> Resolve SMS recipient to individual
3. Create magic link: portalUrl = await createMagicLink(latestCase.id)
4. Send welcome SMS with custom message template

Request Body:
{
  "customMessage": "Optional custom SMS message"
}

Rate Limiting: 5 requests per minute per user

### Frontend: Send Upload Link Modal
File: apps/workspace/src/components/shared/send-upload-link-modal.tsx

- VN/EN language toggle
- Editable message template with placeholders:
  - {{client_name}} -> SMS recipient name
  - {{tax_year}} -> Tax year
  - {{portal_link}} -> Auto-generated portal link
- Default templates provided for both languages

File: apps/workspace/src/routes/clients/$clientId.tsx (lines 196-246)

- Mutation: api.clients.sendUploadLink(clientId, customMessage)
- Optimistic update: Shows SMS preview in chat immediately
- On success: Invalidates client and messages queries

### hasUploadLink Flag
File: apps/api/src/routes/clients/index.ts (line 318)

When fetching client detail:
  hasUploadLink: latestCase ? latestCase._count.magicLinks > 0 : false

- Checks if latest tax case has any magic links
- Used to show "Send Upload Link" button state in UI

---

## 3. PORTAL LINK GENERATION & MAGIC LINKS

### Magic Link Service
File: apps/api/src/services/magic-link.ts

#### createMagicLink()
- Generates 12-char token (nanoid, custom alphabet: 0-9a-z)
- Creates MagicLink record with type: PORTAL (default), SCHEDULE_C, SCHEDULE_E, DRAFT_RETURN
- expiresAt: null (never expires)
- Returns full URL via getMagicLinkUrl(token, type)

#### createMagicLinkWithDeactivation()
- Deactivates all existing links of that type first
- Creates new link atomically
- Used when refreshing links

#### Link Type URLs
PORTAL: https://portal.ellatax.com/u/{token}
SCHEDULE_C: https://portal.ellatax.com/expense/{token}
SCHEDULE_E: https://portal.ellatax.com/rental/{token}
DRAFT_RETURN: https://portal.ellatax.com/draft/{token}

#### validateMagicLink()
- Verifies token validity
- Checks: token exists, active, not expired
- Updates usage stats: lastUsedAt, usageCount++
- Returns tax case, client, checklist, raw images data

### Portal Access Route
File: apps/api/src/routes/portal/index.ts

GET /portal/:token
- Validates magic link token
- Returns client info, tax case data, checklist status, group entities

POST /portal/:token/upload
- Validates token
- Accepts multipart file uploads (max 50 files, 10MB each)
- Uploads to R2, triggers async document classification

### Portal Database Schema
File: packages/db/prisma/schema.prisma

model MagicLink {
  id, caseId, token (unique), type (PORTAL|SCHEDULE_C|SCHEDULE_E|DRAFT_RETURN)
  expiresAt (null = never), isActive, lastUsedAt, usageCount
  draftReturnId, createdAt, updatedAt
}

model Conversation {
  id, caseId (unique), taxCase relation
  messages[], lastMessageAt, unreadCount
  createdAt, updatedAt
}

---

## 4. BUSINESS CLIENT HANDLING IN MULTI-CLIENT GROUPS

### ClientGroup Model
- Represents linked individual + multiple businesses
- All clients in group share clientGroupId
- Portal shows all entities in group

### Group Entity Switching (Portal)
File: apps/api/src/routes/portal/index.ts (lines 76-124)

When accessing portal, if client has group:
1. Find all group members with same tax year
2. Return groupEntities array with id, name, clientType, token
3. Portal UI shows "Switch to [Business Name]" links

### SMS Routing for Business Clients
File: apps/api/src/routes/clients/index.ts (lines 1466-1486)

When sending upload link to business client in group:
- Query for INDIVIDUAL client in same group
- Route SMS to individual's phone with individual's name

Rationale: Business filing is joint effort; SMS goes to person.

---

## 5. ENGAGEMENT HELPER (Multi-Year Support)

File: apps/api/src/services/engagement-helpers.ts

findOrCreateEngagement(tx, clientId, taxYear, profile)
- Creates TaxEngagement (one per client per tax year)
- Copies profile data from ClientProfile if available
- Used by form, clients routes when creating tax cases
- Ensures multi-year support

---

## File Locations Summary

CONVERSATION CREATION:
- apps/api/src/routes/form/index.ts (lines 170-214, 220-259)
- apps/api/src/routes/clients/index.ts (lines 1518-1723)
- apps/api/src/routes/messages/index.ts (lines 66-126)

UPLOAD LINK - BACKEND:
- apps/api/src/routes/clients/index.ts (lines 1414-1513)
- apps/api/src/services/magic-link.ts

UPLOAD LINK - FRONTEND:
- apps/workspace/src/components/shared/send-upload-link-modal.tsx
- apps/workspace/src/routes/clients/$clientId.tsx (lines 196-246)
- apps/workspace/src/lib/api-client.ts (line 290)

PORTAL:
- apps/api/src/routes/portal/index.ts
- apps/api/src/services/magic-link.ts

SCHEMA:
- packages/db/prisma/schema.prisma (Conversation, MagicLink, TaxCase models)
- apps/api/src/services/engagement-helpers.ts

