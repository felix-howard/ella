# Client Detail Page & Business Relationship Model

## Summary
Complete mapping of client/business detail pages, header/overview components, and the ClientGroup relationship model that links individual clients to their business entities.

Date: 2026-04-09

---

## 1. CLIENT DETAIL PAGE ROUTE

File: apps/workspace/src/routes/clients/$clientId.tsx (1,037 lines)

### Header Rendering (Lines 541-743)

**Back Button & Cross-Link Banner (Lines 551-574)**
Shows linked clients in same ClientGroup. If client.clientGroup exists with multiple clients, displays each sibling as a clickable link with icon (Building2 for BUSINESS, User for INDIVIDUAL).

**Avatar Section (Lines 577-597)**
- Rounded-lg for BUSINESS clients, rounded-full for INDIVIDUAL
- Uses getAvatarColor() for dynamic background colors
- Displays initials from client name

**Client Info Section (Lines 590-651)**
- Name (with business type badge for BUSINESS clients)
- Phone (formatted or masked based on user role)
- Email
- Business EIN (masked as ***-**-XXXX)
- Year Switcher (for multi-year engagements)
- "Managed by" staff name
- Tags display

**Status & Action Buttons (Lines 655-741)**
- "Send to Review" (when status = ENTRY_COMPLETE && !isInReview)
- "Mark Filed" (when isInReview && !isFiled)
- "Reopen" (when isFiled)
- Upload Portal Link button
- Message button with unread badge
- Send Upload Link button

**Tab Navigation (Lines 745-819)**
Dynamic tabs based on clientType:
- BUSINESS tabs: Overview, Files, Contractors, Data Entry, Draft Return, [+Schedule C]
- INDIVIDUAL tabs: Overview, Files, Data Entry, Draft Return, [+Schedule C], [+Schedule E]

---

## 2. OVERVIEW TAB COMPONENT

File: apps/workspace/src/components/clients/client-overview-tab/index.tsx (87 lines)

Component structure returns grid with:
1. ClientProfileCard - Name, phone, email with inline edit
2. ClientMetaInfo - Created/updated dates and staff
3. ClientQuickStats - Summary metrics (4 cards)
4. Two-column layout:
   - ClientNotesEditor (2/3 width) - Rich text notes with auto-save
   - ClientAssignedStaff (1/3 width) - "Managed by" staff assignment
5. ClientActivityTimeline - Full width activity history
6. Danger Zone - Delete button

---

## 3. CLIENT-BUSINESS RELATIONSHIP MODEL

### Database Schema (Prisma)

ClientGroup Model (schema.prisma lines 547-557):
- id: String (cuid)
- name: String
- organizationId: String (optional)
- clients: Client[] (one-to-many)
- createdAt, updatedAt

Client Model (schema.prisma lines 559-621):

Key fields for relationship:
- clientType: ClientType (INDIVIDUAL | BUSINESS)
- clientGroupId: String? (foreign key to ClientGroup)
- clientGroup: ClientGroup? (relation, SetNull on delete)

Business-only fields:
- businessType?: BusinessType (SOLE_PROPRIETORSHIP | LLC | PARTNERSHIP | S_CORP | C_CORP)
- einEncrypted?: String (AES-256-GCM encrypted)
- businessAddress, businessCity, businessState, businessZip

Overview fields:
- avatarUrl?: String (R2 storage URL)
- notes?: String (rich text)
- notesUpdatedAt?: DateTime

Relations:
- profile: ClientProfile?
- engagements: TaxEngagement[]
- taxCases: TaxCase[]
- contractors: Contractor[] (business-type only)
- filingBatches: FilingBatch[]
- managedBy: Staff? (who manages)
- createdBy: Staff? (who created)
- updatedBy: Staff? (who modified)

### TypeScript Types (api-client.ts)

Client Type (lines 1315-1337):
- clientType: ClientType
- clientGroupId?: string | null
- clientGroup?: ClientGroup & { clients: ClientPreview[] }
- businessType?, einMasked?, businessAddress?, businessCity?, businessState?, businessZip?

ClientGroup Type (lines 1339-1347):
- id, name, organizationId
- clients: ClientPreview[] (sibling clients)
- _count?: { clients: number }

ClientDetail Type (lines 1584-1594):
Extends Client with:
- profile: ClientProfile | null
- taxCases: TaxCaseSummary[]
- portalUrl: string | null
- smsEnabled: boolean
- notes, avatarUrl, managedBy, createdBy, updatedBy

---

## 4. API ENDPOINTS

### Client Fetch (api-client.ts lines 229-337)

api.clients.get(id: string)
  GET /clients/:id returns ClientDetail

api.clients.list(params)
  GET /clients with pagination, search, filtering

api.clients.update(id, data)
  PATCH /clients/:id with UpdateClientInput

### Backend Implementation (apps/api/src/routes/clients/index.ts line 548)

GET /clients/:id endpoint includes:
1. profile (full)
2. managedBy, createdBy, updatedBy (staff info)
3. clientGroup with sibling clients (where id != :id) - KEY FOR CROSS-LINKING
4. taxCases with magicLinks and counts

Returns:
- Computed display name (firstName + lastName)
- Masked EIN (never encrypted value)
- Resolved avatar URLs
- JSON response with all client data

### Cross-Link Mechanism

1. API returns sibling clients in client.clientGroup.clients
2. React renders banner (lines 551-574) showing linked clients
3. Each sibling is a clickable link to /clients/$clientId with their ID
4. Icon shows type: Building2 for BUSINESS, User for INDIVIDUAL

---

## 5. SUB-COMPONENTS (Overview Tab)

| Component | File | Purpose |
|-----------|------|---------|
| ClientProfileCard | client-overview-tab/client-profile-card.tsx | Name, phone, email with inline edit |
| ClientMetaInfo | client-overview-tab/client-meta-info.tsx | Created/updated dates and staff |
| ClientQuickStats | client-overview-tab/client-quick-stats.tsx | Summary metrics |
| ClientNotesEditor | client-overview-tab/client-notes-editor.tsx | Rich text notes |
| ClientAssignedStaff | client-overview-tab/client-assigned-staff.tsx | Managed by staff |
| ClientActivityTimeline | client-overview-tab/client-activity-timeline.tsx | Activity history |
| ClientAvatarUploader | client-overview-tab/client-avatar-uploader.tsx | Profile picture |

---

## 6. FILE REFERENCES

### Frontend Components
1. apps/workspace/src/routes/clients/$clientId.tsx
2. apps/workspace/src/components/clients/client-overview-tab/index.tsx
3. apps/workspace/src/components/clients/client-overview-tab/client-profile-card.tsx
4. apps/workspace/src/components/clients/client-overview-tab/client-meta-info.tsx
5. apps/workspace/src/components/clients/client-overview-tab/client-quick-stats.tsx
6. apps/workspace/src/components/clients/client-overview-tab/client-notes-editor.tsx
7. apps/workspace/src/components/clients/client-overview-tab/client-assigned-staff.tsx
8. apps/workspace/src/components/clients/client-overview-tab/client-activity-timeline.tsx
9. apps/workspace/src/components/clients/client-overview-tab/client-avatar-uploader.tsx

### API & Types
10. apps/workspace/src/lib/api-client.ts (lines 229-337 for clients endpoints)
11. apps/api/src/routes/clients/index.ts (line 548 for GET /:id endpoint)
12. packages/db/prisma/schema.prisma (lines 547-621)

---

## 7. KEY INSIGHTS

### Entity Separation
- clientType discriminator: INDIVIDUAL vs BUSINESS
- Business-specific fields only populated for BUSINESS type
- Different tab sets for each type

### Grouping Strategy
- ClientGroup created when individual + business pair exists
- All clients in same group share clientGroupId
- Cross-links shown in header banner for easy navigation

### Avatar Styling
- BUSINESS: rounded-lg (square)
- INDIVIDUAL: rounded-full (circle)
- Color from getAvatarColor(name)

### EIN Security
- Stored encrypted (AES-256-GCM)
- Returned masked (***-**-XXXX)
- Never decrypted on frontend

### Staff Attribution
- createdBy: who created the client
- updatedBy: who last modified
- managedBy: current staff managing the client

