# Client Messages Tab Feature (2026-01-15)

**Status:** Complete
**Component:** `ClientMessagesTab`
**Location:** `apps/workspace/src/components/client-detail/`
**Integration:** Client Detail Page (`/clients/$clientId`)

## Overview

Dedicated SMS messaging interface within the client detail page. Provides real-time message thread with polling and race condition protection, reusing existing messaging components.

## Component Architecture

### ClientMessagesTab
**File:** `apps/workspace/src/components/client-detail/client-messages-tab.tsx`
**Size:** ~210 LOC

**Props:**
```typescript
interface ClientMessagesTabProps {
  clientId: string              // Client identifier
  caseId: string | undefined    // Tax case ID (undefined = no active case)
  clientName: string            // For display + QuickActionsBar
  clientPhone: string           // For display + QuickActionsBar
  isActive: boolean             // Controls polling lifecycle
}
```

**Dependencies:**
- `MessageThread` - Displays messages chronologically
- `QuickActionsBar` - SMS input + send (no channel selector)
- `api.messages.list()` - Fetch case messages
- `api.messages.send()` - Send SMS
- `toast` store - Notifications

### Index Export
**File:** `apps/workspace/src/components/client-detail/index.ts`
**Size:** ~8 LOC

Barrel export for component + types:
```typescript
export { ClientMessagesTab } from './client-messages-tab'
export type { ClientMessagesTabProps } from './client-messages-tab'
```

## Race Condition Protection

### Problem
When polling fetches in quick succession or user navigates between tabs, older responses can overwrite newer ones, causing stale data to appear.

### Solution
Three-layer protection:

**1. Fetch ID Tracking**
```typescript
const fetchIdRef = useRef(0)
const currentFetchId = ++fetchIdRef.current
// Later: if (currentFetchId !== fetchIdRef.current) return
```
- Increments on each fetch
- Ignores responses from older fetch IDs
- Prevents stale response overwriting newer data

**2. Concurrent Fetch Prevention**
```typescript
const isFetchingRef = useRef(false)
if (isFetchingRef.current && silent) return
isFetchingRef.current = true
```
- Blocks concurrent fetches during silent polling
- Prevents "thundering herd" of requests
- Only applies to silent polling (background updates)

**3. State Validation on Finally**
```typescript
finally {
  if (currentFetchId === fetchIdRef.current) {
    setIsLoading(false)
    isFetchingRef.current = false
  }
}
```
- Only updates UI if fetch is not stale
- Prevents race condition on unmount

## Polling Architecture

### Lifecycle

```
Tab Mount
  ↓
useEffect (caseId dependency)
  ├─ Reset: setMessages([]), setError(null), invalidate fetchIdRef
  └─ Initial fetch (non-silent)
       ↓
Polling Effect (isActive + caseId)
  ├─ Skip if inactive or no caseId
  └─ Every 10s: fetchMessages(true) [silent mode]
       ├─ No loading state shown
       ├─ Skip if already fetching (isFetchingRef)
       └─ Ignore stale responses
       ↓
Tab Unmount
  └─ Clear interval, cleanup refs
```

### Intervals

- **Initial Load:** Synchronous (non-silent), shows loading state
- **Silent Polling:** Every 10 seconds, no loading state changes
- **Polling Condition:** `isActive && caseId` only

### Silent Mode
When `fetchMessages(silent = true)`:
- No loading state update (prevents flashing skeleton)
- Prevents concurrent fetches via `isFetchingRef`
- Errors logged only in dev mode
- Failed silent polls don't show error UI

## Message States

### Loading
- Shows skeleton in `MessageThread` component
- Only during initial load (non-silent fetch)
- Silent polling doesn't trigger loading state

### Error
- Red alert icon + error message
- Retry button (yellow/blue)
- Shown when non-silent fetch fails
- Stale responses ignored

### Empty
- Message list appears empty
- Tab is active but no messages exist
- Normal state waiting for new messages

### Success
- Chronological message display (ascending time)
- Messages received from API in descending order
- Reversed on display: `response.messages.reverse()`

## Message Flow

### Fetch & Display
```typescript
const response = await api.messages.list(caseId)
// API returns: { messages: Message[] in DESC order }
// Display: reverse() to ASC order
setMessages(response.messages.reverse())
```

### Send Message
```typescript
handleSend(content: string)
  ├─ Optimistic update: add to local state immediately
  ├─ api.messages.send({ caseId, content, channel: 'SMS' })
  ├─ Success: toast success (or info if SMS failed)
  └─ Error: toast error, keep message in list (may fail delivery)
```

### QuickActionsBar Adapter
```typescript
handleQuickActionsSend(content, _channel)
  └─ Ignores channel param, always sends SMS
```
Component forces `defaultChannel="SMS"` to prevent user selection.

## Error Handling

### Network Errors
- Caught in try-catch
- UI shows error state with error message
- Retry button to manually refetch
- Stale requests ignored (no state update)

### Missing Tax Case
- Shows empty state: "Chưa có hồ sơ thuế"
- Suggests creating tax case
- No messaging available without active case

### SMS Send Failure
- Message saved to local state (optimistic update)
- Shows info toast: "Đã lưu nhưng không thể gửi SMS"
- User can see message was attempted

### Development Mode
- Console.error logged for network issues
- Only in `import.meta.env.DEV` blocks

## Performance Notes

### Resource Efficiency
- Polling only runs when tab is active (`isActive`)
- Prevents battery drain on inactive tabs
- Silent polling prevents excessive re-renders

### Memory Safety
```typescript
// Cleanup on unmount
useEffect(() => {
  return () => clearInterval(interval)
}, [isActive, caseId, fetchMessages])

// Refs prevent closure issues
const fetchIdRef = useRef(0)
const isFetchingRef = useRef(false)
```

### State Optimization
- `fetchMessages` wrapped in `useCallback` with `[caseId]` dependency
- Prevents unnecessary interval recalculation
- Stable reference for polling effect

## Integration with Client Detail Page

### File
`apps/workspace/src/routes/clients/$clientId.tsx`

### Tab System
```typescript
type TabType = 'overview' | 'documents' | 'messages'
const [activeTab, setActiveTab] = useState<TabType>('overview')

// Later in render:
<ClientMessagesTab
  caseId={latestCase?.id}
  clientId={clientId}
  clientName={client.name}
  clientPhone={client.phone}
  isActive={activeTab === 'messages'}
/>
```

### Data Flow
```
Client page loads
  ├─ Query client profile (useQuery)
  ├─ Extract latest tax case: latestCase
  └─ Render 3-tab layout
       └─ Messages tab (inactive by default)
            └─ User clicks "Tin nhắn"
                 ├─ activeTab = 'messages'
                 ├─ ClientMessagesTab: isActive = true
                 └─ Start polling (10s interval)
```

## Backward Compatibility

### No Breaking Changes
- New component in dedicated directory
- No modifications to existing message components
- Reuses public interfaces of MessageThread + QuickActionsBar

### Existing Components Unaffected
- `MessageThread` - Used in `/messages` + client detail, no changes
- `QuickActionsBar` - Supports SMS-only mode via props, no changes
- `api.messages` - Existing endpoints, no changes

## Vietnamese UI Labels

| Element | Label |
|---------|-------|
| Tab Name | "Tin nhắn" (Messages) |
| Empty State Title | "Chưa có hồ sơ thuế" (No tax case) |
| Empty State Text | "Tạo hồ sơ thuế để bắt đầu nhắn tin với khách hàng" (Create tax case to message) |
| Error Title | "Không thể tải tin nhắn" (Unable to load messages) |
| Error Button | "Thử lại" (Retry) |
| Send Loading | Via QuickActionsBar isSending prop |
| Success Toast | From `api.messages.send()` response |
| Error Toast | Network error or send failure |
| Info Toast | SMS saved but delivery failed |

## Testing Considerations

### Unit Tests
- Race condition protection with multiple fetches
- Silent vs non-silent polling behavior
- Message reversal (DESC → ASC)
- Optimistic update + actual send
- Error recovery with retry

### Integration Tests
- Tab activation/deactivation polling
- CaseId changes invalidate in-flight requests
- Network failure error states
- QuickActionsBar interaction

### Manual Testing
1. Open client with multiple tax cases
2. Switch between cases (should fetch different messages)
3. Open other tabs and return to messages
4. Send message while polling active
5. Close tab, reopen (should refetch)

## Future Enhancements

### Phase 07+
- Message search + filter
- Message templates
- Unread count badges
- Typing indicator
- WebSocket real-time instead of polling (optional)

---

**Last Updated:** 2026-01-15
**Component Status:** Complete
**Integration Status:** Complete in `/clients/$clientId`
**Test Coverage:** Manual testing complete
