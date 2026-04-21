# Business Detail Page & Upload Link Functionality - Scout Report

**Date:** 2026-04-10  
**Status:** Complete  
**Scope:** Portal/workspace apps, API backend

## Overview

Comprehensive map of files related to:
1. Business detail page component
2. "Send Upload Link" button handler
3. Portal link (magic link) generation
4. Conversation creation for businesses vs individuals
5. "Managed by" column/field implementation

---

## 1. Business Detail Page Component

### Primary Route & Component
- **File:** `/apps/workspace/src/routes/clients/$clientId.tsx` (1,040 lines)
  - Main client detail page component showing Messages, Send Upload Link buttons
  - Tabs: Overview, Files, Checklist, Schedule C/E, Data Entry, Draft Return, Contractors (for business)
  - Handles multi-year engagements via YearSwitcher
  - Includes floating chatbox for conversations
  - Status action mutations: sendToReview, markFiled, reopen
  - Portal link scoped to selected engagement's tax case (lines 700-712)

### Key Business Logic for Businesses
- **Business-specific tab:** "Contractors" tab (1099-NEC management) only shows for BUSINESS clients (line 940)
- **Avatar styling:** Rounded-lg for business, rounded-full for individual (lines 579-588)
- **Managed by display:** Shows staff member managing the client (lines 632-638)
- **Cross-link banner:** Groups individual + business together with navigation links (lines 554-575)

---

## 2. Send Upload Link Button & Conversation Creation

### Frontend Implementation
- **Modal Component:** `/apps/workspace/src/components/shared/send-upload-link-modal.tsx`
  - Shows editable message template with VN/EN language toggle
  - Placeholders: `{{client_name}}`, `{{tax_year}}`, `{{portal_link}}`
  - Templates: Vietnamese & English defaults defined
  
- **Integration in Detail Page:** `/apps/workspace/src/routes/clients/$clientId.tsx` (lines 195-246)
  - `sendUploadLinkMutation` with optimistic update to chatbox
  - Closes modal immediately for snappy UX
  - Builds preview content from template message
  - Creates optimistic temp message in chat until server response
  - API call: `api.clients.sendUploadLink(clientId, customMessage)`

### API Client Method
- **File:** `/apps/workspace/src/lib/api-client.ts` (lines 290-294)
  ```typescript
  sendUploadLink: (id: string, customMessage?: string) =>
    request<{ success: boolean; messageId?: string }>(
      `/clients/${id}/send-upload-link`,
      { method: 'POST', body: JSON.stringify({ customMessage }) }
    )
  ```

### Backend API Endpoint
- **File:** `/apps/api/src/routes/clients/index.ts` (lines 1414-1512)
  - Route: `POST /clients/:id/send-upload-link`
  - Rate limited: 5 requests per 60 seconds
  - **Business phone resolution:** If client is BUSINESS type with clientGroupId, resolves to linked INDIVIDUAL's phone (lines 1471-1486)
  - Creates magic link via `createMagicLink(latestCase.id)`
  - Calls `sendWelcomeMessage()` with custom message support
  - Returns: `{ success: true, messageId }`

### Conversation Creation Flow
- **File:** `/apps/api/src/services/sms/message-sender.ts` (lines 225-289)
  - `sendAndRecordMessage()` - Internal function that creates conversation & message
  - **Upsert pattern:** Creates conversation if not exists, otherwise updates
    ```typescript
    const conversation = await prisma.conversation.upsert({
      where: { caseId },
      update: {},
      create: { caseId },
    })
    ```
  - Creates message record with channel='SMS', direction='OUTBOUND'
  - Publishes realtime event via `publishMessageEventFromConversation()`
  - Updates conversation's `lastMessageAt` and case's `lastContactAt`
  - **Handles SMS failures gracefully:** Records message with error status regardless of Twilio result

---

## 3. Portal Link Generation Logic

### Magic Link Service
- **File:** `/apps/api/src/services/magic-link.ts`

#### Core Functions
1. **`createMagicLink(caseId, options?)`** (lines 46-67)
   - Generates URL-safe 12-char token
   - Creates MagicLink record in DB with type='PORTAL' (default)
   - Never expires (null expiresAt) unless explicitly provided
   - Returns full URL: `{PORTAL_URL}/u/{token}`

2. **`createMagicLinkWithDeactivation(caseId, type?)`** (lines 73-107)
   - Atomic transaction: deactivates existing links + creates new one
   - Ensures only one active link per case/type combo
   - Returns `{ url, expiresAt }`

3. **`getMagicLinkUrl(token, type)`** (lines 24-36)
   - Routes by type: PORTAL, SCHEDULE_C, SCHEDULE_E, DRAFT_RETURN

### Database Model
- **File:** `/packages/db/prisma/schema.prisma` (lines 1020-1033)
  - Unique: token, caseId combo with type
  - Fields: type, expiresAt (null = never expires), isActive, lastUsedAt, usageCount

---

## 4. Business vs Individual Conversation Creation

### Key Difference: SMS Phone Resolution
- **File:** `/apps/api/src/routes/clients/index.ts` (lines 1466-1486)
  - **For INDIVIDUAL:** Uses client's own phone directly
  - **For BUSINESS with group:** Resolves to linked INDIVIDUAL's phone
  - **For BUSINESS without group:** Falls back to business phone with warning log

### Conversation Lifecycle
- **File:** `/packages/db/prisma/schema.prisma` (lines 967-980)
  - One conversation per TaxCase (UNIQUE constraint on caseId)
  - Both BUSINESS and INDIVIDUAL use same model
  - TaxCase determines entity type, not conversation

---

## 5. "Managed by" Column/Field Implementation

### Frontend Displays

#### Client List Table
- **File:** `/apps/workspace/src/components/clients/client-list-table.tsx` (lines 266-294)
  - Admin-only column with avatar + name of staff member
  - Uses `client.managedBy` object with `{ id, name, avatarUrl }`

#### Client Detail Page Header
- **File:** `/apps/workspace/src/routes/clients/$clientId.tsx` (lines 632-638)
  - Shows in header metadata section with Users icon

#### Client Overview Tab
- **File:** `/apps/workspace/src/components/clients/client-overview-tab/index.tsx`
  - Sub-component: `ClientAssignedStaff` (right side of 3-column grid)

### Backend Model
- **File:** `/packages/db/prisma/schema.prisma`
  ```prisma
  model Client {
    managedById String?
    managedBy   Staff?   @relation(...)
  }
  ```

### API Returns managedBy
- **File:** `/apps/api/src/routes/clients/index.ts` (lines 169-172)
  - Clients list query includes: `managedBy: { select: { id, name, avatarUrl } }`

---

## Critical Files by Purpose

### Business Detail Page
- `/apps/workspace/src/routes/clients/$clientId.tsx`
- `/apps/workspace/src/components/clients/client-overview-tab/index.tsx`

### Send Upload Link
- `/apps/workspace/src/components/shared/send-upload-link-modal.tsx`
- `/apps/api/src/routes/clients/index.ts` (lines 1414-1512)
- `/apps/api/src/services/sms/message-sender.ts` (lines 59-106, 225-289)

### Portal Links & Conversations
- `/apps/api/src/services/magic-link.ts`
- `/packages/db/prisma/schema.prisma` (Conversation, MagicLink, TaxCase models)

### Managed By
- `/apps/workspace/src/components/clients/client-list-table.tsx`
- `/apps/workspace/src/routes/clients/$clientId.tsx`
- `/apps/workspace/src/components/clients/client-overview-tab/client-assigned-staff.tsx`
- `/packages/db/prisma/schema.prisma` (Client.managedById field)

---

## Key Implementation Notes

1. **Business Phone Resolution**: Businesses SMS goes to linked individual's phone if grouped
2. **Magic Links**: Never expire by default (expiresAt = null)
3. **Conversation Upsert**: One per TaxCase, created on first message
4. **Entity Separation**: clientType (INDIVIDUAL/BUSINESS) + clientGroupId for grouping
5. **Message Templates**: Support custom placeholders: {{client_name}}, {{tax_year}}, {{portal_link}}

