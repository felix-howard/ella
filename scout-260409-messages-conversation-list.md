# Scout Report: Messages Page Conversation List

**Date:** 2026-04-09  
**Status:** Complete  
**Scope:** Frontend routes, components, API endpoints, and data types for Messages page conversation list

---

## Summary

Located all files related to the Messages page conversation list feature. This is a unified inbox system showing conversations with clients sorted by most recent message. Component structure includes conversation list sidebar (left) and conversation detail (right) with split-view on desktop and single-panel on mobile.

---

## Files Found

### Route Components (Frontend)

**Messages Layout (Parent Route)**
- `/C/Users/Admin/Desktop/ella/apps/workspace/src/routes/messages.tsx`
  - Parent layout for all `/messages/*` routes
  - Manages conversation list state (fetch, polling, realtime)
  - Renders split-view (desktop) or single-panel (mobile)
  - Integrates realtime message updates via `useRealtimeMessages` hook
  - Implements fallback polling (60s interval) for conversation list refresh

**Messages Index (Empty State)**
- `/C/Users/Admin/Desktop/ella/apps/workspace/src/routes/messages/index.tsx`
  - Empty state component for `/messages/` route
  - Auto-redirects to first conversation on desktop (mobile shows list)
  - Fetches first conversation to enable redirect logic
  - Shows "Select a conversation" message while empty

**Conversation Detail View**
- `/C/Users/Admin/Desktop/ella/apps/workspace/src/routes/messages/$caseId.tsx`
  - Shows message thread for specific case
  - Displays client header with avatar, name, phone, tax year
  - Includes message thread with loading state
  - Includes QuickActionsBar for sending messages
  - Includes voice call integration via CallButton and ActiveCallModal
  - Implements optimistic message updates (temp-* messages)
  - Fetches case data and messages on load

### Conversation List Components

**Conversation List**
- `/C/Users/Admin/Desktop/ella/apps/workspace/src/components/messaging/conversation-list.tsx`
  - Container component rendering list of conversations
  - Props: `conversations`, `activeCaseId`, `isLoading`, `className`
  - Loading state with skeleton loaders (5 placeholders)
  - Empty state with inbox icon and message
  - Maps conversations to ConversationListItem components

**Conversation List Item**
- `/C/Users/Admin/Desktop/ella/apps/workspace/src/components/messaging/conversation-list-item.tsx`
  - Single conversation row in sidebar
  - Displays: client avatar (initials), client name, last message preview, timestamp
  - Unread badge with count (shows "9+" for 9+)
  - Styling: active state (primary tint + accent), unread state (subtle highlight), default hover
  - Message preview handling:
    - Translates call messages (completed, busy, no-answer, failed)
    - Truncates text to 60 chars + "..."
    - Shows "Sent a photo" for attachment-only messages
    - Sanitizes text content
  - Links to `/messages/$caseId` route
  - Supports multi-language with i18n

### API Endpoints (Backend)

**Messages Route**
- `/C/Users/Admin/Desktop/ella/apps/api/src/routes/messages/index.ts`
  - **GET /messages/conversations** - List all conversations (unified inbox)
    - Query params: `page`, `limit`, `unreadOnly`
    - Returns: Conversation[] + totalUnread + pagination
    - Auth scope: org-scoped via buildClientScopeFilter
    - Ordering: by lastMessageAt desc, then createdAt desc
    - Includes: client, taxCase, lastMessage (latest message in conversation)
  - **GET /messages/:caseId/unread** - Get unread count for specific case
  - **GET /messages/:caseId** - Get conversation + messages for case
    - Query params: `page`, `limit`
    - Auto-creates conversation if not exists (upsert)
    - Resets unreadCount to 0 when fetching
    - Auto-repairs R2 attachment keys from URLs
  - **GET /messages/media/:messageId/:index** - Proxy for message attachments
    - Handles CORS bypass for R2 signed URLs
    - Auto-repairs renamed R2 keys
  - **POST /messages/send** - Send message to client
    - Creates message record + sends SMS if channel=SMS
    - Publishes realtime event (non-blocking)
    - Updates conversation lastMessageAt
    - Emits chat monitoring event for staff
  - **POST /messages/remind/:caseId** - Send missing docs reminder
  - **POST /messages/remind-batch** - Batch reminder cron job

### API Client (TypeScript Definitions)

**File:** `/C/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts`

**Methods:**
- `api.messages.list(caseId: string)` => MessagesResponse
- `api.messages.send(data: SendMessageInput)` => SendMessageResponse
- `api.messages.listConversations(params?)` => ConversationsResponse
- `api.messages.getUnreadCount(caseId: string)` => UnreadResponse

**Key Types:**
- `Conversation` - unified inbox item with client, lastMessage, unreadCount
- `ConversationsResponse` - list response with totalUnread + pagination
- `Message` - individual message with channel, direction, attachments
- `SendMessageInput` - caseId, content, channel
- `SendMessageResponse` - message, sent flag, smsEnabled, error

---

## Architecture Overview

**Data Flow:**

1. Messages Layout → fetches conversations → ConversationList
2. ConversationList → maps each → ConversationListItem
3. ConversationListItem → links to ConversationDetailView on click
4. ConversationDetailView → fetches messages + case data → MessageThread + QuickActionsBar

**Key Patterns:**
- Optimistic updates: temp-* message IDs shown instantly, replaced on success
- Realtime + fallback polling (60s)
- Org-scoped queries via buildClientScopeFilter
- Auto-create conversation on first message access
- Unread reset when viewing conversation

---

## File Paths Summary

**Frontend Routes:**
- `apps/workspace/src/routes/messages.tsx` (parent layout)
- `apps/workspace/src/routes/messages/index.tsx` (empty state)
- `apps/workspace/src/routes/messages/$caseId.tsx` (detail view)

**Components:**
- `apps/workspace/src/components/messaging/conversation-list.tsx`
- `apps/workspace/src/components/messaging/conversation-list-item.tsx`
- `apps/workspace/src/components/messaging/index.ts` (barrel export)
- `apps/workspace/src/components/messaging/message-thread.tsx`
- `apps/workspace/src/components/messaging/quick-actions-bar.tsx`
- `apps/workspace/src/components/messaging/call-button.tsx`
- `apps/workspace/src/components/messaging/active-call-modal.tsx`

**API:**
- `apps/api/src/routes/messages/index.ts`

**Client Library:**
- `apps/workspace/src/lib/api-client.ts` (types + methods)

---

## Related Components (Supporting)

- MessageBubble, TypingIndicator - individual message rendering
- TemplatePicker - message template selection
- AudioPlayer, IncomingCallModal - call features
- useRealtimeMessages hook - realtime subscriptions
- useVoiceCall hook - Twilio integration

