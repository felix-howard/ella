# Scout Report: Messaging System - Sender Information Flow

**Date**: 2026-04-07  
**Focus**: Locate files related to sender info handling in floating chatbot vs. messages page

---

## Summary

Located all files related to the messaging system that handle message sending and sender information. The issue appears to be that messages sent from the floating chatbot sometimes lack sender info (userId, member info, avatar) while messages from the full messages page include it properly.

**Root cause location**: Both paths call the same API endpoint (`POST /messages/send`), which properly includes `sentById: user.staffId`. The difference must be in:
1. How messages are rendered in `MessageBubble` component (different avatar/sender display logic)
2. How optimistic messages are constructed (missing sender info in temp messages)
3. How responses are merged back into the UI state

---

## Critical Files

### Frontend Components

#### Floating Chatbox (Messages sent here)
- **File**: `/apps/workspace/src/components/chatbox/floating-chatbox.tsx`
- **Key insight**: 
  - Line 66-104: `sendMessageMutation` creates optimistic temp message WITHOUT sender info
  - Line 76-84: Temp message object missing `sentBy` field
  - Line 68: Calls `api.messages.send({ caseId, ...data })`
  - Line 93-95: On success, invalidates and refetches messages

#### Messages Detail Page (Full unified inbox)
- **File**: `/apps/workspace/src/routes/messages/$caseId.tsx`
- **Key insight**:
  - Line 125-166: `handleSend` creates optimistic message WITHOUT sender info either
  - Line 129-137: Temp message object also missing `sentBy`
  - Line 143: Calls `api.messages.send({ caseId, content, channel })`
  - Line 149: Response includes `sentBy` from API, replaces temp message

#### Message Rendering Component
- **File**: `/apps/workspace/src/components/messaging/message-bubble.tsx`
- **Key insight**:
  - Line 316-333: `StaffAvatar` component renders sender avatar
  - Line 317: Returns empty spacer if `sentBy` is falsy
  - Line 196-201: Outbound image-only messages show avatar
  - Line 245: Outbound text messages show avatar
  - Avatar can be image URL or colored initials badge

#### Quick Actions Bar (Message composer)
- **File**: `/apps/workspace/src/components/messaging/quick-actions-bar.tsx`
- **Key insight**:
  - Line 127-139: `handleSend` sanitizes and calls `onSend(trimmed, 'SMS')`
  - Always sends as 'SMS' channel (line 132)
  - Does not handle sender info directly

### Backend API Routes

#### Message Send Endpoint
- **File**: `/apps/api/src/routes/messages/index.ts`
- **Key insight**:
  - Line 376-507: `POST /messages/send` route
  - Line 408: Sets `sentById: user.staffId` from authenticated user
  - Line 410-414: Includes `sentBy` in response with id, name, avatarUrl
  - Line 442-443: For SMS channel, calls `sendSmsOnly()` to send via Twilio
  - Line 496: Response resolves avatar URL via `resolveAvatarUrl()`
  - Line 490-506: Returns `sentBy` in response

#### Message Sender Service
- **File**: `/apps/api/src/services/sms/message-sender.ts`
- **Key insight**:
  - Line 193-213: `sendSmsOnly()` sends SMS without creating message record
  - Line 220-282: `sendAndRecordMessage()` creates message WITHOUT sentById
  - Line 244-254: Creates message with channel, direction, content, templateUsed
  - **ISSUE**: `sentById` is NOT set in `sendAndRecordMessage()` at line 243-255
  - Line 257-262: Publishes realtime event (non-blocking)

### API Client

- **File**: `/apps/workspace/src/lib/api-client.ts`
- **Key insight**:
  - Line 689-693: `messages.send()` endpoint definition
  - Line 690: Calls `POST /messages/send` with SendMessageInput

### Data Types

- **Type** `Message` in api-client.ts
- **Type** `SendMessageResponse` (returned by POST /messages/send)
- **Field**: `sentBy?: { id: string; name: string; avatarUrl: string | null }`

---

## The Sender Info Issue

### Problem Flow

**Floating Chatbox Path:**
1. User types message → Click send
2. `handleSend()` in floating-chatbox.tsx creates optimistic temp message (NO `sentBy`)
3. API call: `api.messages.send({ caseId, content, channel })`
4. Backend: Creates message with `sentById: user.staffId`
5. Backend response includes populated `sentBy` object
6. Frontend: `onSuccess()` invalidates and refetches (line 94)
7. New fetch should include `sentBy` from backend

**Messages Page Path:**
1. User types message → Click send
2. `handleSend()` in $caseId.tsx creates optimistic temp message (NO `sentBy`)
3. API call: `api.messages.send({ caseId, content, channel })`
4. Backend: Creates message with `sentById: user.staffId`
5. Backend response includes populated `sentBy` object
6. Frontend: Replaces temp message with response (line 146-151)
7. Should display `sentBy` from response

### Root Cause Analysis

**Difference between implementations:**
- **Floating chatbox** (line 94): Invalidates query → triggers refetch
- **Messages page** (line 146-151): Directly replaces optimistic with response

**Issue could be:**
1. **Optimistic message rendering**: When temp message displays before response, avatar component shows empty spacer (line 317 returns spacer if no sentBy)
2. **Response merge issue**: If response doesn't include full `sentBy` object
3. **Avatar resolution timing**: `resolveAvatarUrl()` is async; might not be awaited in floating chatbox invalidation path

---

## Files to Examine / Modify

### For Debugging
1. Add logging to see what `sentBy` looks like in responses
2. Check if floating chatbox response includes full `sentBy` object
3. Verify `resolveAvatarUrl()` completes before cache invalidation

### Recommended Fixes
1. **Include `sentBy` in optimistic messages** from the start:
   - Get current user info in floating-chatbox.tsx before sending
   - Build optimistic message with `sentBy` object populated

2. **Ensure avatar URLs are resolved**:
   - Floating chatbox path uses cache invalidation, which might not await avatar resolution
   - Consider pre-fetching avatars or using fallback initials

3. **Consistent sender display**:
   - Align optimistic message structure between floating-chatbox.tsx and $caseId.tsx
   - Both should include `sentBy` with at least name/initials

---

## File Locations (Absolute Paths)

### Frontend
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/chatbox/floating-chatbox.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/routes/messages/$caseId.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/messaging/message-bubble.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/messaging/quick-actions-bar.tsx
- C:/Users/Admin/Desktop/ella/apps/workspace/src/lib/api-client.ts

### Backend
- C:/Users/Admin/Desktop/ella/apps/api/src/routes/messages/index.ts
- C:/Users/Admin/Desktop/ella/apps/api/src/services/sms/message-sender.ts

### Supporting Files
- C:/Users/Admin/Desktop/ella/apps/workspace/src/routes/messages/index.tsx (main messages layout)
- C:/Users/Admin/Desktop/ella/apps/workspace/src/components/messaging/index.ts (exports)
- C:/Users/Admin/Desktop/ella/apps/workspace/src/routes/cases/$caseId/messages.tsx (redirect to unified inbox)

---

## Unresolved Questions

1. Does `api.messages.send()` response in floating-chatbox path include full `sentBy` with avatarUrl resolved?
2. Why does messages-page work but floating-chatbox doesn't (if both use same API)?
3. Is the issue timing-related (avatar not resolved yet when displayed)?
4. Are there any differences in how the two paths merge responses back to UI state?
