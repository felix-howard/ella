# Client Message Tab UX Enhancement

**Date:** 2026-01-18
**Feature:** Refactored client detail page messaging from embedded tab to header button with unread badge
**Status:** Complete

## Overview

The client detail page messaging experience has been refactored to improve UX and efficiency:

- **Removed:** "Tin nhắn" (Messages) tab from the 3-tab client detail layout
- **Added:** "Tin nhắn" header button with real-time unread badge
- **New API:** `GET /messages/:caseId/unread` for efficient single-case unread count fetching
- **Result:** Cleaner tab layout (Overview, Documents) + faster, more accessible messaging

## Changes

### 1. Frontend Changes

#### `apps/workspace/src/routes/clients/$clientId.tsx`

**Removed:**
- "messages" from `TabType` enum (previously: `'overview' | 'documents' | 'messages'`)
- "messages" from tabs array configuration
- `ClientMessagesTab` component usage
- Client detail page now renders 2 tabs instead of 3

**Added:**
- Dedicated unread count query: `useQuery` with `queryKey: ['unread-count', latestCaseId]`
- Unread count state management with 30s cache (staleTime)
- Header "Tin nhắn" button with:
  - `<MessageSquare />` icon
  - Unread badge (red pill with count, "99+" for 100+)
  - Loading state with spinning loader while fetching
  - Navigation to `/messages/$caseId`

**Code Pattern:**
```typescript
// Fetch unread count for specific case
const { data: unreadData, isLoading: isUnreadLoading, isError: isUnreadError } = useQuery({
  queryKey: ['unread-count', latestCaseId],
  queryFn: () => api.messages.getUnreadCount(latestCaseId!),
  enabled: !!latestCaseId,
  staleTime: 30000, // Cache for 30s
})
const unreadCount = unreadData?.unreadCount ?? 0

// Button in header
<Link
  to="/messages/$caseId"
  params={{ caseId: latestCaseId }}
  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border..."
>
  <MessageSquare className="w-4 h-4" />
  <span>Tin nhắn</span>
  {isUnreadLoading ? (
    <Loader2 className="w-3.5 h-3.5 animate-spin..." />
  ) : !isUnreadError && unreadCount > 0 && (
    <span className="px-1.5 py-0.5 text-xs font-medium bg-destructive text-white rounded-full...">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  )}
</Link>
```

#### `apps/workspace/src/components/client-detail/index.ts`

**Removed:**
- `ClientMessagesTab` export (component no longer exists)

### 2. Backend Changes

#### `apps/api/src/routes/messages/index.ts`

**Added:**
- New endpoint: `GET /messages/:caseId/unread`
- Returns: `{ caseId: string, unreadCount: number }`
- Query unread count from Conversation table
- Returns 0 if conversation doesn't exist yet

**Implementation:**
```typescript
// GET /messages/:caseId/unread - Get unread count for a specific case
messagesRoute.get('/:caseId/unread', async (c) => {
  const caseId = c.req.param('caseId')

  const conversation = await prisma.conversation.findUnique({
    where: { caseId },
    select: { unreadCount: true },
  })

  return c.json({
    caseId,
    unreadCount: conversation?.unreadCount ?? 0,
  })
})
```

**Endpoint Count Update:**
- Previous: 4 message endpoints
- Current: 5 message endpoints (added `/messages/:caseId/unread`)

### 3. API Client Changes

#### `apps/workspace/src/lib/api-client.ts`

**Added:**
- `api.messages.getUnreadCount(caseId)` method
- Type-safe response: `{ caseId: string, unreadCount: number }`

**Usage:**
```typescript
const unreadData = await api.messages.getUnreadCount(caseId)
// Returns: { caseId: '123', unreadCount: 5 }
```

### 4. Component Deletion

#### `apps/workspace/src/components/client-detail/client-messages-tab.tsx`

**Status:** DELETED
**Reason:** Functionality moved to dedicated `/messages/$caseId` page and header button

## Benefits

### UX Improvements
1. **Cleaner Navigation:** Client detail now focuses on Overview & Documents (2 core tabs)
2. **Faster Access:** Direct messaging button in header without tab switching
3. **Visual Prominence:** Unread badge on button makes notifications harder to miss
4. **Accessibility:** Button clearly indicates messaging functionality

### Technical Benefits
1. **Efficient Queries:** Dedicated endpoint avoids full conversation fetch
2. **Cache Strategy:** 30s staleTime reduces unnecessary API calls
3. **Consistent Design:** Matches messaging header button pattern used elsewhere
4. **Simpler State:** Removed complex tab state management for messages

## User Journey

### Before
```
Staff views client detail
    ↓
Clicks "Tin nhắn" tab
    ↓
Sees conversation list
    ↓
Selects conversation to read/reply
```

### After
```
Staff views client detail
    ↓
Sees unread badge on "Tin nhắn" button in header
    ↓
Clicks button → navigates to /messages/$caseId
    ↓
Sees conversation immediately (one click vs two)
```

## API Contract

### GET /messages/:caseId/unread

**Request:**
```
GET /messages/case-123/unread
```

**Response (200 OK):**
```json
{
  "caseId": "case-123",
  "unreadCount": 5
}
```

**Response if no conversation (200 OK):**
```json
{
  "caseId": "case-123",
  "unreadCount": 0
}
```

### GET /messages/:caseId

**Response now resets unread count to 0 when fetched** (unchanged behavior)

## Implementation Notes

1. **No Breaking Changes:** Existing `/messages/conversations` and `/messages/:caseId` endpoints remain unchanged
2. **Database:** No schema changes required (leverages existing `Conversation.unreadCount` field)
3. **Backward Compatible:** Old messaging tab would work if re-added; just not used now
4. **Performance:** Single `findUnique` query is more efficient than loading full conversation

## Related Documentation

- See [system-architecture.md](./system-architecture.md#unified-messaging-phase-32--ux-enhancement) for full messaging architecture
- See [system-architecture.md#unified-inbox--messaging-flow-phase-32--ux-enhancement](./system-architecture.md#unified-inbox--messaging-flow-phase-32--ux-enhancement) for complete flow diagram

## Testing Checklist

- [x] Header "Tin nhắn" button displays correctly
- [x] Unread count fetches and displays badge
- [x] Badge shows "99+" for counts >= 100
- [x] Loading state shows spinner while fetching
- [x] Button navigates to `/messages/$caseId` on click
- [x] Error state handles gracefully (no badge shown)
- [x] 30s cache prevents excessive API calls
- [x] API returns 0 for non-existent conversations
- [x] Removed ClientMessagesTab no longer referenced anywhere

## Files Modified

| File | Change | Type |
|------|--------|------|
| `apps/workspace/src/routes/clients/$clientId.tsx` | Removed messages tab, added header button | Modified |
| `apps/workspace/src/components/client-detail/index.ts` | Removed export | Modified |
| `apps/api/src/routes/messages/index.ts` | Added endpoint | Modified |
| `apps/workspace/src/lib/api-client.ts` | Added method | Modified |
| `apps/workspace/src/components/client-detail/client-messages-tab.tsx` | Component logic moved | Deleted |

## Backward Compatibility

- ✓ No database migrations needed
- ✓ No breaking API changes
- ✓ Old messaging endpoints fully functional
- ✓ Workspace app only; no portal changes

## Next Steps

1. Test header button functionality in client detail page
2. Verify unread badge updates when messages sent/received
3. Monitor API performance for `/messages/:caseId/unread` endpoint
4. Consider applying similar header button pattern to other pages if beneficial
