# Chat Monitoring & Call Handling - Scout Report Index

Generated: 2026-03-30

## Quick Navigation

Start with one of these three files based on your need:

### For Quick Answers (Best for Overview)
**File:** `SCOUT_FINDINGS_SUMMARY.txt`
- Direct answers to your 3 questions
- Code examples and file locations
- ~5 minute read

### For Technical Deep Dive (Best for Implementation)
**File:** `scout-260330-chat-monitoring.md`
- Detailed flow diagrams
- Configuration details
- Data models and constraints
- 10-15 minute read

### For Complete File Reference (Best for Navigation)
**File:** `COMPLETE_FILE_LIST.txt`
- All 13 files with line numbers
- Function-level granularity
- Quick lookup by feature

---

## Your 3 Questions - Quick Answers

### Question 1: How chat monitoring notifications are triggered
**Key Files:**
- `apps/api/src/routes/messages/index.ts` - Trigger point
- `apps/api/src/jobs/notify-admin-staff-chat.ts` - Batching job
- `apps/api/src/services/sms/notification-service.ts` - SMS delivery

**Flow:** Staff message → `message/staff-sent` event → Inngest batching (5 events/30s) → Query admins with subscriptions → Send SMS with 5-min throttle

---

### Question 2: How phone calls are handled
**Key File:**
- `apps/api/src/routes/webhooks/twilio.ts` - All 8+ webhook endpoints

**Covered:**
- Inbound call routing (to last-contact staff or online admins)
- Voicemail fallback
- Recording capture
- Unknown caller handling

---

### Question 3: Notification subscription model
**Key Files:**
- `packages/db/prisma/schema.prisma` - Schema definition
- `apps/api/src/routes/team/index.ts` - API endpoints

**Model:** NotificationSubscription(subscriberId, targetStaffId, type)
- Type: UPLOAD or CHAT
- Logic: Requires BOTH global preference (notifyOnChat) AND specific subscription

---

## File Organization

### Core Chat Monitoring (What triggers notifications)
1. **Message Send Trigger**
   - File: `apps/api/src/routes/messages/index.ts` (lines 464-480)
   - Emits `message/staff-sent` to Inngest

2. **Inngest Batching Job**
   - File: `apps/api/src/jobs/notify-admin-staff-chat.ts`
   - Batches 5 events per 30 seconds
   - Queries admins with criteria:
     - Role: ADMIN
     - Preference: notifyOnChat: true
     - Subscription: type='CHAT' for this staff member

3. **SMS Delivery**
   - File: `apps/api/src/services/sms/notification-service.ts`
   - Function: `notifyStaffChat()` (lines 381-440)
   - Throttle: 5-minute window per recipient+staff pair
   - Localization: VI and EN templates

### Subscription Management (How admins enable monitoring)
1. **API Endpoints**
   - File: `apps/api/src/routes/team/index.ts`
   - GET `/team/members/:staffId/notification-subscriptions` (lines 510-567)
   - PUT `/team/members/:staffId/notification-subscriptions` (lines 569-627)

2. **Validation**
   - File: `apps/api/src/routes/team/schemas.ts`
   - Schema: `updateNotificationSubscriptionsSchema`

3. **Database**
   - File: `packages/db/prisma/schema.prisma`
   - Model: `NotificationSubscription`
   - Enum: `SubscriptionType` (UPLOAD, CHAT)

### Call Handling (Inbound/outbound call workflows)
1. **Twilio Webhooks**
   - File: `apps/api/src/routes/webhooks/twilio.ts` (979 lines)
   - SMS handlers: /webhooks/twilio/sms, /status
   - Voice handlers: /voice, /voice/incoming, /voice/recording, etc.
   - Voicemail: /voice/voicemail-recording, /voicemail-complete

2. **SMS Processing**
   - File: `apps/api/src/services/sms/webhook-handler.ts`
   - Unknown caller handling
   - MMS media processing (up to 10 items)

3. **Voice Helpers**
   - File: `apps/api/src/services/voice/voicemail-helpers.ts`
   - E.164 validation
   - Placeholder conversation creation
   - Duration formatting

---

## Key Concepts

### Notification Types (SubscriptionType)
- **UPLOAD:** Staff client uploaded documents
- **CHAT:** Staff sent message to client

### Two-Level Subscription System
1. **Global Preference:** `Staff.notifyOnChat` boolean
2. **Specific Subscription:** `NotificationSubscription(subscriberId, targetStaffId, type)`

Both required for notification to be sent.

### Batching Strategy
- **Batching Key:** `${staffId}-${caseId}` (staff-client pair)
- **Max Size:** 5 messages
- **Timeout:** 30 seconds
- **Result:** One SMS per recipient containing message count

### Rate Limiting
- **Chat Monitor:** 5-minute throttle per recipient+staff pair
- **Twilio Webhooks:** 60 requests/minute per IP
- **Staff Message SMS:** 1-second delay between sends (sequential)

---

## Implementation Checklist

If you're implementing a new feature related to chat monitoring:

- [ ] Check notification subscription model in schema
- [ ] Verify staff has notifyOnChat preference enabled
- [ ] Ensure NotificationSubscription records exist
- [ ] Review Inngest batching configuration (5 events, 30s timeout)
- [ ] Check SMS throttle map logic (5-minute window)
- [ ] Validate phone number format (E.164 required)
- [ ] Test with both subscribed and non-subscribed admins
- [ ] Verify SMS message localization (VI/EN)

---

## Glossary

- **staffCaseKey:** Unique identifier for batching: `${staffId}-${caseId}`
- **NotificationSubscription:** Database record linking subscriber to monitored staff
- **SubscriptionType:** Enum with values UPLOAD and CHAT
- **E.164:** International phone number format: +[country][number]
- **TwiML:** Twilio Markup Language for call handling responses
- **Unknown Caller:** Phone number not in client database
- **Placeholder Conversation:** Auto-created for unknown callers

---

## Related Features

These features interact with chat monitoring:

- **Document Upload Notifications:** Similar system for UPLOAD subscriptions
- **Staff Presence:** Determines who receives incoming calls
- **Voicemail:** Fallback when no staff online
- **MMS Support:** Media attachment handling in SMS webhook
- **Audit Logging:** Tracks subscription changes

---

## Next Steps

1. Read the appropriate detailed report based on your task
2. Reference the complete file list for line numbers and imports
3. Review code snippets provided in SCOUT_FINDINGS_SUMMARY
4. Follow the data flow diagrams in scout-260330-chat-monitoring.md

