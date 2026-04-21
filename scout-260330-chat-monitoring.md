# Scout Report: Chat Monitoring Notifications

**Date:** 2026-03-30  
**Topic:** Chat monitoring notifications, call handling webhooks, and notification subscription system

---

## Summary

Found comprehensive chat monitoring notification system with key components:
1. **Notification Trigger**: Chat monitoring fires when staff members send messages to clients
2. **Batching & Delivery**: Inngest-based job batches events and sends SMS to subscribed admins
3. **Call Handling**: Complete Twilio webhook infrastructure for inbound/outbound calls with recording
4. **Subscription Model**: Database schema with staff notification preferences and targeted subscriptions

---

## 1. Chat Monitoring Notification Flow

### Trigger Point: Staff Message Sent
**File:** `apps/api/src/routes/messages/index.ts` (lines 464-480)

When a staff member sends a message via `/messages/send` endpoint:
- Event name: `message/staff-sent`
- Batching key: `staffCaseKey` (groups by staff + case pair)
- Triggered for ANY outbound message (SMS, portal, system channels)

### Event Definition
**File:** `apps/api/src/lib/inngest.ts` (lines 64-86)

```
StaffMessageSentEvent:
  - staffId: sender ID
  - staffName: sender name
  - caseId: case ID
  - clientName: client name
  - staffCaseKey: `${staffId}-${caseId}` for batching
```

---

## 2. Inngest Batching Job: Chat Monitor

**File:** `apps/api/src/jobs/notify-admin-staff-chat.ts`

### Batching Configuration
- Max size: 5 events per batch
- Timeout: 30 seconds
- Batching key: `event.data.staffCaseKey` (groups same staff-client pairs)

### Job Flow (3 steps)

**Step 1: Get Sending Staff's Organization**
- Finds staff and retrieves organizationId

**Step 2: Query Recipients (Admins with Chat Subscription)**
- Queries staff with ALL conditions:
  - organizationId matches sender's org
  - id != staffId (don't notify sender)
  - phoneNumber is not null
  - notifyOnChat: true (global preference flag)
  - isActive: true
  - role: 'ADMIN'
  - notificationSubscriptions with targetStaffId=sender AND type='CHAT'

**Step 3: Send SMS Notifications**
- Sends SMS to each recipient sequentially with 1s delay
- Uses `notifyStaffChat()` function
- Generates localized message (VI/EN)

---

## 3. SMS Notification Service

**File:** `apps/api/src/services/sms/notification-service.ts`

### notifyStaffChat Function (lines 381-440)

Parameters:
- recipientId: Admin receiving SMS
- recipientPhone: Admin's phone number
- staffId: Monitored staff member ID
- staffName: Monitored staff name
- clientName: Client's name
- messageCount: Number of messages in batch
- language: VI or EN

Throttling:
- 5-minute throttle per recipient + staff pair (in-memory)
- Uses Map to track last send time
- Prevents duplicate SMS within window

---

## 4. Notification Subscription Schema

**File:** `packages/db/prisma/schema.prisma`

NotificationSubscription model:
- id: cuid
- subscriberId: admin receiving notifications
- targetStaffId: specific staff member to monitor
- type: SubscriptionType (UPLOAD or CHAT)
- Unique constraint: (subscriberId, targetStaffId, type)
- Indexes: subscriberId, targetStaffId

Staff model fields:
- notifyOnUpload: boolean (global preference)
- notifyOnChat: boolean (global preference)
- notificationSubscriptions: relation
- notificationSubscribers: relation

Logic: Admin receives notification if:
- Admin's notifyOnChat: true AND
- Admin has NotificationSubscription(subscriberId=admin, targetStaffId=staff, type='CHAT')

---

## 5. Subscription Management API

**File:** `apps/api/src/routes/team/index.ts` (lines 510-627)

### GET /team/members/:staffId/notification-subscriptions
Returns:
- uploadSubscriptions: string[] (target staff IDs)
- chatSubscriptions: string[] (target staff IDs)
- members: Available staff to subscribe to

### PUT /team/members/:staffId/notification-subscriptions
Request body:
- targetStaffIds: string[]
- type: 'UPLOAD' or 'CHAT'

Transactional:
1. Delete existing subscriptions for type
2. Create new subscriptions for each targetStaffId

---

## 6. Call Handling Webhooks

**File:** `apps/api/src/routes/webhooks/twilio.ts`

### Outbound Call: POST /webhooks/twilio/voice
- Handles outbound call initiation
- Returns TwiML with recording enabled
- Registers status and recording callbacks

### Inbound Call: POST /webhooks/twilio/voice/incoming
- Finds caller's client and conversation
- Routes to last-contact staff or all online admins
- Creates inbound call message record
- Falls back to voicemail if no staff online

### Voicemail: POST /webhooks/twilio/voice/voicemail-recording
- Stores voicemail recording URL
- Handles unknown callers (creates placeholder conversation)
- Updates message with recording metadata
- Increments conversation unreadCount

### Recording Webhooks
- POST /webhooks/twilio/voice/recording (outbound)
- POST /webhooks/twilio/voice/inbound-recording (inbound)
- POST /webhooks/twilio/voice/voicemail-recording (voicemail)

All: validate signature, parse metadata, update message

### Call Status Updates
- POST /webhooks/twilio/voice/status (tracks terminal states)
- POST /webhooks/twilio/voice/dial-complete (routes to voicemail if needed)

---

## 7. Incoming SMS Processing

**File:** `apps/api/src/services/sms/webhook-handler.ts`

### POST /webhooks/twilio/sms

Flow:
1. Validate Twilio signature
2. Check for duplicate messages
3. Find client by phone (exact, E.164, normalized)
4. For unknown callers: create placeholder
5. Process MMS media
6. Create message record
7. Update conversation
8. Create action for staff

Unknown Caller handling:
- Creates placeholder client + case + conversation
- Marks action with isUnknownCaller: true
- Sets priority: HIGH

---

## 8. Related Files Summary

Key Files:
- apps/api/src/routes/messages/index.ts - Message send; triggers event
- apps/api/src/jobs/notify-admin-staff-chat.ts - Batching job; SMS sending
- apps/api/src/services/sms/notification-service.ts - notifyStaffChat() function
- apps/api/src/services/sms/templates/staff-chat-monitor.ts - SMS template
- apps/api/src/routes/team/index.ts - Subscription endpoints
- apps/api/src/routes/webhooks/twilio.ts - All Twilio webhooks
- apps/api/src/services/sms/webhook-handler.ts - SMS processing
- apps/api/src/services/voice/voicemail-helpers.ts - Voice helpers
- packages/db/prisma/schema.prisma - Schema definitions

---

## 9. Key Configuration & Constraints

Rate Limiting:
- Twilio webhook: 60 requests/min per IP
- Chat monitor SMS: 5-min throttle per recipient+staff pair
- Staff message: 1s delay between SMS sends

Validation:
- Phone format: E.164 required
- Message content: Max 1600 chars
- Recording duration: Max 14400s
- SMS message: Max 160 chars GSM-7

Database Indexes:
- NotificationSubscription.subscriberId
- NotificationSubscription.targetStaffId
- Unique: (subscriberId, targetStaffId, type)

