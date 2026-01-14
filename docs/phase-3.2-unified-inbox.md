# Phase 3.2: Unified Inbox & Conversation Management

**Status:** Complete
**Completed:** 2026-01-14
**Previous Phase:** [Phase 3.1 - Twilio SMS Integration](./phase-3.1-second-half.md)

## Overview

Phase 3.2 implements a unified message inbox for workspace staff, allowing centralized management of all client conversations across SMS, portal, and system channels. The feature uses a split-view layout with real-time polling for live updates.

## Architecture

### API Layer (Backend)

**Route:** `apps/api/src/routes/messages/index.ts`

#### Endpoints (4 new/enhanced)

1. **GET /messages/conversations** - List all conversations
   - Returns paginated list of conversations
   - Includes last message preview, unread counts, client info
   - Filters: `unreadOnly` (boolean), pagination (page, limit)
   - Calculates total unread count across all conversations
   - Ordered by `lastMessageAt` (newest first)

2. **GET /messages/:caseId** - Fetch conversation & messages
   - Auto-creates conversation if missing (upsert pattern)
   - Resets unread count to 0 on access
   - Returns paginated messages (ordered desc by createdAt)
   - Prevents race conditions on concurrent access

3. **POST /messages/send** - Send message to client
   - Creates message record in database
   - Updates conversation timestamp & case lastContactAt
   - Sends SMS if channel is SMS and Twilio enabled
   - Supports channels: SMS, PORTAL, SYSTEM
   - Returns sent confirmation + SMS status

4. **POST /messages/remind/:caseId** - Send missing docs reminder
   - Sends templated SMS reminder for missing documents
   - Verifies case exists before sending
   - Returns success status + message ID

#### Database Patterns

**Upsert Pattern (Race Condition Prevention):**
```typescript
const conversation = await prisma.conversation.upsert({
  where: { caseId },
  update: {},
  create: { caseId },
})
```
- Ensures conversation exists without duplicates
- Safe for concurrent requests
- No separate read + create logic

**Unread Count Reset:**
```typescript
if (conversation.unreadCount > 0) {
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { unreadCount: 0 },
  })
}
```
- Resets when staff accesses conversation
- Tracks client-facing notification status

### Frontend Layer (Workspace)

**Location:** `apps/workspace/src/routes/messages/`

#### Pages

1. **index.tsx** - Unified Inbox Page
   - Split-view layout: left panel (conversations) + right panel (thread)
   - Left Panel:
     - Header with "Tin nhắn" title + unread badge
     - Filter toggle: show all vs unread-only (aria-pressed state)
     - Refresh button (with loading spinner)
     - ConversationList component with scrolling
   - Right Panel:
     - Message thread if conversation selected
     - Empty state with helpful text if none selected
     - Auto-navigates to first conversation if available
   - Polling: 30-second interval for background updates

2. **$caseId.tsx** - Conversation Detail Page
   - Header with client info:
     - Avatar with initials
     - Client name + case status badge
     - Phone number + language + tax year
     - Back button (mobile only)
   - Message Thread:
     - Chronological display (oldest → newest)
     - Channel indicators (SMS/PORTAL/SYSTEM chips)
     - Sender direction (INBOUND/OUTBOUND)
   - Quick Actions Bar:
     - Message input field
     - Channel picker (SMS or PORTAL)
     - Send button with loading state
   - Polling: 10-second interval while viewing
   - Optimistic updates: message shows immediately on send

#### Components

**Location:** `apps/workspace/src/components/messaging/`

| Component | Purpose | Props |
|-----------|---------|-------|
| `ConversationList` | Scrollable list of conversations | `conversations`, `activeCaseId`, `isLoading` |
| `ConversationListItem` | Individual conversation row | `conversation`, `isActive`, `isLoading` |
| `MessageThread` | Chronological message display | `messages`, `isLoading`, `className` |
| `MessageBubble` | Single message renderer | `message`, `clientName` |
| `QuickActionsBar` | Message input + send | `onSend`, `isSending`, `clientName`, `defaultChannel` |
| `TemplatePicker` | Pre-defined template selector | `onSelect` (future) |
| `index.ts` | Named exports | - |

**Key Features:**
- Loading states & skeletons during data fetch
- Empty states with helpful UI guidance
- Unread badges on conversation items
- Optimistic message updates
- Silent refresh (non-blocking background updates)

### State Management

**Store:** `apps/workspace/src/lib/api-client.ts`

- Centralized API client with type-safe methods
- Methods: `messages.listConversations()`, `messages.list()`, `messages.send()`
- Returns typed responses matching database schema

## UI/UX Design

### Vietnamese Localization

| English | Vietnamese |
|---------|-----------|
| Messages | Tin nhắn |
| Select conversation | Chọn cuộc hội thoại |
| Show all | Hiện tất cả |
| Unread only | Chỉ chưa đọc |
| Refresh | Làm mới |
| Profile | Hồ sơ |

### Color Scheme

- Primary: Mint (#10b981)
- Status badges: Color-coded by case status
- Unread count: Error red (#ef4444)
- Avatar: Primary light background

### Accessibility

- `aria-label` on all buttons
- `aria-pressed` on toggle buttons (unread filter)
- `aria-hidden="true"` on decorative icons
- Semantic HTML: `<header>`, proper heading hierarchy
- Link to profile view: `<User>` icon + "Hồ sơ" text
- Back button for mobile navigation

## Real-Time Updates

### Polling Strategy

| Location | Interval | Purpose |
|----------|----------|---------|
| Inbox page | 30s | Background updates to conversation list |
| Active conversation | 10s | Keep message thread current |

**Implementation:**
```typescript
const POLLING_INTERVAL = 30000 // 30 seconds

useEffect(() => {
  const interval = setInterval(() => {
    fetchConversations(true) // Silent refresh
  }, POLLING_INTERVAL)
  return () => clearInterval(interval)
}, [fetchConversations])
```

- Silent refresh (no visible loading state on polling)
- Manual refresh button for immediate updates
- Separate interval for active conversation (10s for responsiveness)

### Optimistic Updates

**Message Send:**
1. User sends message
2. Immediately displayed in thread (optimistic update)
3. Background sync via polling (10s)
4. If send fails, error toast shown (future)

**Benefits:**
- Faster perceived performance
- Better UX for slow networks
- Automatic sync prevents manual refresh need

## Data Structures

### Conversation Type
```typescript
{
  id: string
  caseId: string
  unreadCount: number
  lastMessageAt: string | null
  createdAt: string
  updatedAt: string
  client: {
    id: string
    name: string
    phone: string
    language: 'VI' | 'EN'
  }
  taxCase: {
    id: string
    taxYear: number
    status: TaxCaseStatus
  }
  lastMessage?: {
    id: string
    content: string
    channel: MessageChannel
    direction: MessageDirection
    createdAt: string
  }
}
```

### Message Type
```typescript
{
  id: string
  conversationId: string
  channel: 'SMS' | 'PORTAL' | 'SYSTEM'
  direction: 'INBOUND' | 'OUTBOUND'
  content: string
  createdAt: string
  updatedAt: string
  templateUsed?: string
  twilioSid?: string
}
```

## Error Handling

**Frontend:**
- Network errors caught in try-catch
- Graceful degradation: show last known data on error
- Dev console logging for debugging
- TODO: Show error toast notifications

**Backend:**
- Case not found: 404 error
- SMS disabled: 400 error with clear message
- Validation via Zod schemas
- Global error middleware catches exceptions

## Testing Checklist

- [ ] Conversation list loads with unread badges
- [ ] Unread-only filter toggles correctly
- [ ] Manual refresh updates conversation list
- [ ] Auto-polling updates every 30 seconds
- [ ] Clicking conversation navigates to detail view
- [ ] Message history loads with proper order (oldest → newest)
- [ ] Client header shows correct info + status badge
- [ ] Manual refresh in conversation works
- [ ] Sending SMS/PORTAL message works
- [ ] Optimistic update shows message immediately
- [ ] Back button works on mobile (hidden on desktop)
- [ ] Link to client profile opens correct page
- [ ] Active conversation polls every 10 seconds
- [ ] Empty state displays when no conversation selected
- [ ] Loading skeleton shows during initial fetch
- [ ] Pagination works for large conversation lists
- [ ] Aria labels present on all interactive elements

## Known Limitations & Future Work

### Phase 3.3
- Message delivery status tracking (read receipts)
- SMS delivery notifications via webhooks
- Message search & filtering
- Conversation archiving
- Typing indicators
- File attachments via message composer

### Phase 4.0
- Email message support
- Message scheduling
- Message templates with variables
- Bulk messaging to multiple cases
- Message history export

## Integration Points

### With Phase 3.1 (SMS)
- SMS messages appear in unified inbox
- Twilio webhook creates/updates messages
- SMS sending via quick actions bar
- Message templates from SMS service

### With Client Portal
- Portal upload creates SYSTEM messages in inbox
- Portal messages stored in conversation thread
- Client receives SMS notifs from inbox

### With Workspace Pages
- Client detail page links to their conversation
- Case detail page shows conversation snippet
- Actions related to messages appear in queue

## Performance Notes

- Conversation list pagination: 50 per page default
- Message history pagination: 20 per page default
- Real-time polling: lightweight queries only
- Unread count aggregation: uses Prisma `_sum`
- Message ordering: indexed by createdAt DESC

## File Structure

```
apps/workspace/
├── src/
│   ├── routes/
│   │   └── messages/
│   │       ├── index.tsx          # Unified inbox page
│   │       ├── $caseId.tsx        # Conversation detail
│   │       └── components/        # Page-specific components
│   ├── components/
│   │   └── messaging/
│   │       ├── conversation-list.tsx
│   │       ├── conversation-list-item.tsx
│   │       ├── message-thread.tsx
│   │       ├── message-bubble.tsx
│   │       ├── quick-actions-bar.tsx
│   │       ├── template-picker.tsx
│   │       └── index.ts
│   └── lib/
│       └── api-client.ts          # Type-safe API methods

apps/api/
├── src/
│   └── routes/
│       └── messages/
│           ├── index.ts           # API endpoints
│           └── schemas.ts         # Zod validation
```

---

**Last Updated:** 2026-01-14
**Next Phase:** Phase 3.3 - SMS Status Tracking & Delivery Notifications
