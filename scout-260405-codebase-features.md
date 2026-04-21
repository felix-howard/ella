# Ella Codebase Features Report
Generated: 2026-04-05

## 1. REGISTRATION FORM LINK FEATURE

### Data Models
- Staff.formSlug: Individual form slug (unique per org)
- Lead.campaignTag: Event source (e.g., "free-tax-meeting-march-2026")
- Lead.tags: Array including campaignTag

### Components
- SettingsFormLinksTab: Container for org/lead/client form links
- LeadFormLinkCard: Base URL + campaign slug input
- ClientFormLinkCard: Generic form + auto-send toggle

### URLs
- Org form: /register/{orgSlug}
- Campaign form: /register/{orgSlug}/{eventSlug}
- Client intake: /form/{orgSlug}
- Staff form: /form/{orgSlug}/{staffSlug}

### API
- POST /leads: Public lead creation (no auth)
- GET /org-settings: Fetch slug
- PUT /org-settings: Update auto-send setting

---

## 2. LEADS PAGE

### Route: /leads/

### Components
- LeadsToolbar: Search, filters, bulk SMS action
- LeadListTable: Multi-select table with pagination
- LeadDetailDrawer: Right-side 900px panel
- ConvertLeadDialog: Conversion form
- BulkSmsDialog: SMS composer

### State
- search (debounced 300ms)
- statusFilter (NEW | CONTACTED | LOST | CONVERTED)
- tagFilter (string)
- selectedIds (Set)
- page (pagination)

### LeadDetailDrawer Sections
- Contact Info (phone, email, business, source, created)
- Tags (campaign + custom)
- Status (buttons for NEW/CONTACTED/LOST)
- Notes (textarea, auto-save)
- Actions (convert/delete)
- Message History (last 20 SMS logs)

### Data Fetching
- useQuery(['lead', id], staleTime: 30s)
- Invalidates: ['leads'], ['lead', id], ['lead-tags']

### Mutations
- status update (optimistic)
- notes save (auto-save on blur)
- tags (add/remove)
- delete (with confirmation)

---

## 3. BULK SMS DIALOG

### Features
- Message textarea with {{firstName}} + {{formLink}} placeholders
- Character counter (160 char warning)
- Form link type toggle: org-level vs staff-level
- Staff dropdown (filters to those with formSlug)
- Real-time preview for first lead
- Cursor position preservation on placeholder insert

### State Machine
idle -> sending -> success/partial/error
success: auto-close 2s
partial: show counts + error details
error: retry button

### API: POST /leads/bulk-sms
- Input: { leadIds[], message, formLinkType, staffSlug? }
- Output: { sent, failed, errors[] }
- Twilio integration per lead

---

## 4. MESSAGES PAGE

### Data Models
Conversation:
- id, caseId (1:1 unique)
- lastMessageAt, unreadCount
- Index: [lastMessageAt DESC, createdAt DESC]

Message:
- id, conversationId
- channel (SMS | CALL | SYSTEM)
- direction (INBOUND | OUTBOUND)
- content (max 5000 chars)
- twilioSid, twilioStatus
- attachmentUrls, attachmentR2Keys
- sentBy: Staff?

### API Endpoints
- GET /messages/conversations
  - Query: page, limit, unreadOnly
  - Returns: Conversations with latest message + case + client
  - Sorting: lastMessageAt DESC, createdAt DESC

- GET /messages/:conversationId
  - Returns: Full conversation with all messages ASC
  - Resolves R2 signed URLs
  - Auto-repairs missing R2 keys

- POST /messages
  - Creates message, updates conversation
  - Twilio integration

### Unread Badge
- Red badge on Messages nav
- Polling: 30s interval
- Stale time: 10s
- Display max: "99+"

---

## 5. LEAD-TO-CLIENT CONVERSION

### Pre-Conversion Check
api.leads.convertCheck(lead.id)
- hasDuplicate: boolean
- existingClient?: { firstName, lastName }
- Warns on duplicate phone

### Conversion Form
- Managed By: Staff dropdown (optional)
- Language: VI or EN (default VI)
- Tax Year: [currentYear-3, currentYear-2, currentYear-1]
- Send Welcome SMS: checkbox (default checked)

### Process: POST /leads/:id/convert
- Input: { managedById?, language, taxYear, sendWelcomeSms }
- Atomically:
  1. Create Client from Lead data
  2. Set Lead.convertedToId, status=CONVERTED, convertedAt
  3. Create TaxEngagement for year
  4. Send welcome SMS if enabled
- Returns: { success, clientId }
- Redirects to /clients/{clientId}

---

## 6. SIDEBAR NAVIGATION

### Base Items (all users)
- Dashboard (LayoutDashboard)
- Clients (Users)
- Messages (MessageSquare) [with unread badge]

### Admin-Only Items
- Leads (Megaphone)
- Team (UsersRound)

### Always Present
- Settings (Settings)

### Desktop
- Fixed left, w-60 expanded / w-16 collapsed
- Collapse toggle: ChevronLeft/Right
- Transition: 300ms
- Z-index: 40

### Mobile
- Slide-in drawer, w-60
- Overlay backdrop (black/50)
- Auto-closes on route change
- Escape key closes
- Z-index: 50

### Active State
- Background: primary-light
- Color: primary
- Font: bold
- Icon stroke: 2.5

### Bottom
- User profile (avatar, name, org)
  - Links to /settings?tab=profile
- Logout button

---

## DATABASE MODELS

Lead: id, firstName, lastName, phone, email, businessName, status (NEW|CONTACTED|CONVERTED|LOST), campaignTag, tags[], notes, convertedToId, convertedAt, organizationId

Client: id, firstName, lastName, phone, email, name (computed), language (VI|EN), source, tags[], avatarUrl, notes, notesUpdatedAt, managedById, organizationId

SmsSendLog: id, message, status (SENT|DELIVERED|FAILED|UNDELIVERED), twilioSid, error, leadId, sentById (Staff), organizationId, sentAt

Organization: id, slug (unique), clerkOrgId (unique), name, isActive, autoSendFormClientUploadLink, smsLanguage, missedCallTextBack

Staff: id, formSlug (org-scoped unique), name, email, role, phone, isActive

---

## KEY FILES

### Routes
- apps/workspace/src/routes/leads/index.tsx
- apps/workspace/src/routes/messages/index.tsx
- apps/workspace/src/routes/settings.tsx

### Lead Components
- apps/workspace/src/components/leads/lead-detail-drawer.tsx
- apps/workspace/src/components/leads/bulk-sms-dialog.tsx
- apps/workspace/src/components/leads/convert-lead-dialog.tsx
- apps/workspace/src/components/leads/lead-form-link-card.tsx

### Settings Components
- apps/workspace/src/components/settings/settings-form-links-tab.tsx
- apps/workspace/src/components/settings/client-form-link-card.tsx

### Sidebar
- apps/workspace/src/components/layout/sidebar.tsx
- apps/workspace/src/components/layout/sidebar-content.tsx

### API
- apps/api/src/routes/leads/index.ts
- apps/api/src/routes/messages/index.ts

### Database
- packages/db/prisma/schema.prisma
