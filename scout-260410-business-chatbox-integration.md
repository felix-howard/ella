# Business Detail Page & Chatbot Integration - Scout Report

Date: 2026-04-10
Status: Complete

## Files Found

### Business Detail Page
- apps/workspace/src/routes/clients/$clientId.tsx (1,059 lines)
  - Main page component with floating chatbox integration
  - Owner individual resolution (lines 282-289)
  - Portal URL resolution (lines 297-300)  
  - Message case ID resolution (lines 302-310)
  - FloatingChatbox props (lines 1046-1053)

### Chat Widget Component
- apps/workspace/src/components/chatbox/floating-chatbox.tsx (216 lines)
  - Main chat component, Facebook Messenger-style
  - Message management with polling/realtime
  - Voice calling via Twilio
  - Props: caseId, clientName, clientPhone, clientId, unreadCount

### Chat Sub-Components
- apps/workspace/src/components/chatbox/chatbox-button.tsx
- apps/workspace/src/components/chatbox/chatbox-header.tsx
- apps/workspace/src/components/chatbox/index.ts
- apps/workspace/src/components/messaging/message-thread.tsx
- apps/workspace/src/components/messaging/quick-actions-bar.tsx
- apps/workspace/src/components/messaging/active-call-modal.tsx

### Client Components & Relationships
- apps/workspace/src/components/clients/client-overview-tab/index.tsx
- apps/workspace/src/components/clients/client-linked-entity-card.tsx (shows Business/Owner links)
- apps/workspace/src/components/clients/client-list-table.tsx
- apps/workspace/src/components/shared/send-upload-link-modal.tsx

### Backend Phone Resolution (CRITICAL)
- apps/api/src/routes/clients/index.ts (lines 1508-1554)
  - POST /clients/:id/send-upload-link endpoint
  - Resolves BUSINESS phone to linked INDIVIDUAL phone
  - Finds individual in same ClientGroup
  - Uses individual's phone for SMS
  - Creates conversation on individual's case

### Message & SMS Services
- apps/api/src/services/sms/message-sender.ts (lines 225-289)
  - sendAndRecordMessage() function
  - Creates/upserts conversation
  - Records SMS/PORTAL messages
  - Publishes realtime events

### Portal & Links
- apps/api/src/services/magic-link.ts
  - createMagicLink(caseId)
  - Portal link scoped to case (individual's for businesses)

### API Client Methods
- apps/workspace/src/lib/api-client.ts (lines 229-337)
  - api.clients.get, list, update, sendUploadLink
  - api.messages.list, send, getUnreadCount

### Database Schema
- packages/db/prisma/schema.prisma
  - ClientGroup model (lines 547-557)
  - Client model (lines 559-621)
  - managedById field for staff assignment
  - Conversation model (unique on caseId)

### Hooks
- apps/workspace/src/hooks/use-realtime-messages.ts
- apps/workspace/src/hooks/use-voice-call.ts
- apps/workspace/src/hooks/use-org-role.ts

---

## Key Implementation Details

### Phone Resolution Flow

FRONTEND (apps/workspace/src/routes/clients/$clientId.tsx):
- Line 1049: Passes clientPhone={client.phone} to FloatingChatbox
- For BUSINESS clients: uses BUSINESS phone
- Issue: Does not resolve to individual owner's phone

BACKEND (apps/api/src/routes/clients/index.ts lines 1508-1554):
- POST /clients/:id/send-upload-link
- Checks: if client.clientType === 'BUSINESS' && client.clientGroupId
- Query: finds individual in same ClientGroup
  where: { clientGroupId, clientType: 'INDIVIDUAL' }
- Resolution: smsPhone = individual.phone
- Result: SMS goes to INDIVIDUAL phone
- Creates conversation under INDIVIDUAL case

### Business-Client Relationship

ClientGroup Model:
- Connects INDIVIDUAL + BUSINESS clients
- All clients in group share clientGroupId
- One-to-many: group -> multiple clients

Client Fields:
- clientType: INDIVIDUAL | BUSINESS
- clientGroupId: String (FK to ClientGroup)
- clientGroup: Relation with siblings
- businessType: SOLE_PROPRIETORSHIP | LLC | PARTNERSHIP | S_CORP | C_CORP
- managedById: Staff managing this client
- createdById, updatedById: Audit trail

### Message Case ID Resolution (Line 303)

const messageCaseId = ownerIndividual?.latestCaseId || activeCaseId

- Used for: api.messages.getUnreadCount(messageCaseId)
- For business clients: queries individual's latest case
- For individual clients: uses their own case

### Portal URL Resolution (Lines 297-300)

const portalUploadUrl = ownerIndividual?.portalUrl || selectedCase?.portalUrl || client?.portalUrl

- Prefers individual owner's URL for business clients
- Portal links scoped to individual's case in backend

---

## Risk Analysis

MISMATCH: Phone Routing
- Frontend chatbox: uses client.phone (BUSINESS phone)
- Backend SMS: resolves to individual.phone  
- Voice calls: target business phone
- Issue: Fragmented conversation across channels

CORRECT: Message & Portal Routing
- Unread count: uses individual's case
- Portal uploads: scoped to individual's case
- Indicates intentional individual routing

---

## Unresolved Questions

1. Should FloatingChatbox receive ownerIndividual?.phone instead of client.phone?
2. Should chatbox caseId be ownerIndividual?.latestCaseId instead of activeCaseId?
3. How do conversations consolidate if both individuals and businesses contacted?
4. Is messageCaseId variable actually used by chatbox, or only for unread queries?

