# Phase 3.1 Second Half - Automated SMS Notifications & Batch Reminders

**Status:** Complete - 2026-01-13
**Branch:** feature/phase-3-communication

## Overview

Phase 3.1 Second Half extends the core SMS infrastructure with automated notification system. This triggers SMS automatically on key events (welcome, blurry docs) and provides batch reminder processing for missing documents with smart throttling.

**New Features:**
- Welcome SMS on client creation
- Auto-blurry document notifications from AI pipeline
- Missing docs reminder endpoints (single & batch)
- Concurrent batch processing with rate limiting
- Intelligent throttling (1h blurry, 24h missing docs)
- 3-day grace period before first reminder

## Architecture

```
┌─────────────────────────────────────────────┐
│    Automated Notification Service           │
├─────────────────────────────────────────────┤
│                                             │
│  Triggers:                                  │
│  ├─ Client onboarding → Welcome SMS         │
│  ├─ Blurry detection → Resend request SMS   │
│  └─ Missing docs check → Reminder SMS       │
│                                             │
│  notification-service.ts                    │
│  ├─ notifyBlurryDocument()                  │
│  ├─ notifyMissingDocuments()                │
│  ├─ getCasesNeedingReminders()              │
│  └─ sendBatchMissingReminders()             │
│                                             │
└────────┬──────────────────────────┬─────────┘
         ↓                          ↓
  [Message Sender]         [Batch Processor]
  (single notifications)   (cron job support)
         ↓                          ↓
    [Twilio SDK]              [Concurrency Control]
```

## Notification Service

**File:** `apps/api/src/services/sms/notification-service.ts`

High-level notification orchestration with smart throttling and helper functions.

### Auto-Trigger Points

#### 1. Welcome SMS (Client Onboarding)

**File:** `apps/api/src/routes/clients/index.ts`

When creating new client + case, welcome SMS automatically sent:

```typescript
// In POST /clients
await sendWelcomeMessage(
  result.taxCase.id,
  result.client.name,
  result.client.phone,
  magicLink,
  result.taxCase.taxYear,
  (result.client.language as 'VI' | 'EN') || 'VI'
)
```

**Response includes:**
```json
{
  "client": { ... },
  "taxCase": { ... },
  "magicLink": "...",
  "smsStatus": {
    "sent": true,
    "error": null
  }
}
```

#### 2. Blurry Document SMS (AI Pipeline)

**File:** `apps/api/src/services/ai/document-pipeline.ts`

When blur detection triggered in AI pipeline, auto-send resend request:

```typescript
// In processImage() after blur detection
if (needsResend) {
  notifyBlurryDocument(caseId, [docType]).catch((err) => {
    console.error('[Pipeline] Failed to send blurry SMS:', err)
  })
}
```

- Fire-and-forget (non-blocking)
- Logged on error (won't crash pipeline)
- SMS sent in background

### Notification Functions

#### notifyBlurryDocument(caseId, docTypes)

Sends blurry resend request to client with 1-hour throttle.

**Parameters:**
- `caseId: string` - Tax case identifier
- `docTypes: string[]` - Array of document type names (e.g., ['W2', 'FORM_1099_NEC'])

**Returns:**
```typescript
{
  success: boolean           // Operation succeeded
  smsSent: boolean          // SMS actually sent
  error?: string            // Error code (THROTTLED, CASE_NOT_FOUND, NO_MAGIC_LINK, etc.)
  messageId?: string        // Database message ID if sent
}
```

**Throttling:** Max 1 SMS per case per hour for blurry notifications.

**Error Cases:**
- `SMS_NOT_ENABLED` - Twilio not configured
- `NO_DOC_TYPES` - Empty docTypes array
- `CASE_NOT_FOUND` - Case doesn't exist
- `NO_MAGIC_LINK` - No active magic link for case
- `THROTTLED` - SMS sent within last hour (returns success: true)

#### notifyMissingDocuments(caseId)

Sends missing documents reminder with 24-hour throttle.

**Parameters:**
- `caseId: string` - Tax case identifier

**Returns:** Same as `notifyBlurryDocument()`

**Processing:**
1. Fetch case + client info
2. Get active magic link
3. Query missing checklist items (MISSING status, required only)
4. Extract document labels (Vietnamese via template.labelVi)
5. Check 24-hour throttle
6. Send reminder via sendMissingDocsReminder()

**Throttling:** Max 1 SMS per case per 24 hours for missing docs.

**Error Cases:**
- `SMS_NOT_ENABLED`, `CASE_NOT_FOUND`, `NO_MAGIC_LINK`
- `NO_MISSING_DOCS` - All required docs already received

#### getCasesNeedingReminders()

Query cases eligible for batch reminders.

**Criteria:**
- Case status: `WAITING_DOCS`
- Has required checklist items with status: `MISSING`
- Case created > 3 days ago (grace period)
- No reminder sent in last 24 hours

**Returns:**
```typescript
Array<{
  caseId: string
  clientName: string
  missingCount: number
}>
```

**Implementation:**
- Efficient query with nested where clauses
- Filters out recently reminded cases
- Excludes grace period cases (within 3 days)

#### sendBatchMissingReminders()

Batch send reminders to all eligible cases with concurrency control.

**Returns:**
```typescript
{
  sent: number              // Successfully sent SMS
  failed: number            // Failed attempts
  skipped: number           // Throttled (recently sent)
  details: Array<{
    caseId: string
    result: string          // 'sent', 'throttled', 'failed: ERROR_CODE'
  }>
}
```

**Processing:**
- Gets eligible cases via getCasesNeedingReminders()
- Processes in batches of 5 concurrent (BATCH_CONCURRENCY)
- Uses Promise.allSettled() for error handling
- Logs each result
- Non-blocking: continues even if individual SMS fail

**Batch Example:**
```
Cases: A, B, C, D, E, F, G, H, I, J
Batch 1 (concurrent): A, B, C, D, E → 5 SMS sent simultaneously
Batch 2 (concurrent): F, G, H, I, J → 5 SMS sent simultaneously
```

## API Endpoints

**File:** `apps/api/src/routes/messages/index.ts`

### POST /messages/remind/:caseId

Send missing documents reminder to specific case.

**Parameters:**
- `caseId` (path param) - Tax case ID

**Response (200):**
```json
{
  "success": true,
  "smsSent": true,
  "messageId": "msg_12345",
  "error": null
}
```

**Error Response (404):**
```json
{
  "error": "NOT_FOUND",
  "message": "Case not found"
}
```

**Error Response (400):**
```json
{
  "error": "SMS_DISABLED",
  "message": "SMS is not configured"
}
```

**Use Cases:**
- Staff manually trigger reminder for specific client
- Follow-up after failed auto-notification
- One-off reminder outside of batch schedule

### POST /messages/remind-batch

Send reminders to all eligible cases (for cron job).

**Parameters:** None

**Response (200):**
```json
{
  "success": true,
  "sent": 12,
  "failed": 2,
  "skipped": 5,
  "details": [
    { "caseId": "case_1", "result": "sent" },
    { "caseId": "case_2", "result": "throttled" },
    { "caseId": "case_3", "result": "failed: CASE_NOT_FOUND" },
    ...
  ]
}
```

**Error Response (400):**
```json
{
  "error": "SMS_DISABLED",
  "message": "SMS is not configured"
}
```

**Intended Usage:**
- Called by cron job (e.g., daily at 10 AM)
- Idempotent: throttling prevents duplicate reminders
- Can be called multiple times (safe)

**Example cron setup (Node Cron):**
```typescript
import cron from 'node-cron'

// Daily at 10:00 AM
cron.schedule('0 10 * * *', async () => {
  const response = await fetch('https://api.example.com/messages/remind-batch', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer CRON_TOKEN' }
  })
  const result = await response.json()
  console.log(`Batch reminders: sent=${result.sent}, failed=${result.failed}`)
})
```

## Throttling & Grace Periods

### Blurry Notification Throttle

**Duration:** 1 hour (60 * 60 * 1000 ms)

**Logic:**
- Check if `Message` with `templateUsed = 'blurry_resend'` exists
- Within last 1 hour for same conversation/case
- If exists: Return `{ success: true, smsSent: false, error: 'THROTTLED' }`
- If not: Send SMS and create new message record

**Purpose:** Avoid spamming client with multiple blurry requests for same document.

### Missing Documents Throttle

**Duration:** 24 hours (24 * 60 * 60 * 1000 ms)

**Logic:**
- Same as blurry, checks for `templateUsed = 'missing_docs'`
- Prevents multiple reminders in single day
- Applies to both single and batch notifications

### Case Grace Period

**Duration:** 3 days (3 * 24 * 60 * 60 * 1000 ms)

**Logic:**
- Applied only in batch processing
- Exclude cases where `createdAt > now - 3 days`
- Gives new clients time to upload documents before first reminder

**Purpose:** Avoid harassing new clients immediately after intake.

## Integration Points

### 1. Client Onboarding → Welcome SMS

**File:** `apps/api/src/routes/clients/index.ts` (POST /clients)

```typescript
// Line 141-148
const smsResult = await sendWelcomeMessage(
  result.taxCase.id,
  result.client.name,
  result.client.phone,
  magicLink,
  result.taxCase.taxYear,
  (result.client.language as 'VI' | 'EN') || 'VI'
)
smsStatus = { sent: smsResult.smsSent, error: smsResult.error }
```

Response includes `smsStatus` with success/error.

### 2. Blurry Detection → Auto SMS

**File:** `apps/api/src/services/ai/document-pipeline.ts` (processImage)

```typescript
// Line 132-134
notifyBlurryDocument(caseId, [docType]).catch((err) => {
  console.error('[Pipeline] Failed to send blurry SMS notification:', err)
})
```

Triggered when `shouldRequestResend()` returns true.

### 3. Missing Docs Check → API Endpoints

**Files:** `apps/api/src/routes/messages/index.ts`

- Manual trigger: POST /messages/remind/:caseId
- Batch trigger: POST /messages/remind-batch (from cron)

### 4. Helpers → Get Magic Link & Case Info

**File:** `apps/api/src/services/sms/notification-service.ts`

Private helpers that fetch data:
- `getActiveMagicLink(caseId)` - Gets latest active magic link
- `getCaseClientInfo(caseId)` - Gets name, phone, language, taxYear

## Error Handling

All notification functions return `SendMessageResult`:

```typescript
{
  success: boolean           // Operation succeeded
  smsSent: boolean          // SMS actually sent to Twilio
  messageId?: string        // DB message ID if created
  error?: string            // Error code
}
```

**Error Codes:**
- `SMS_NOT_ENABLED` - Twilio not configured
- `NO_DOC_TYPES` - Empty array passed
- `CASE_NOT_FOUND` - Case doesn't exist
- `NO_MAGIC_LINK` - No active magic link
- `NO_MISSING_DOCS` - No missing required docs
- `THROTTLED` - Already sent recently (success: true)

**Caller Strategy:**
- Check `smsSent` to know if SMS was actually sent
- Check `error` for reason if not sent
- Log but don't fail if SMS fails
- All errors should be logged for monitoring

## Database Schema Changes

No new tables. Uses existing models:

```prisma
// Message (extended use)
- templateUsed: Now includes 'blurry_resend', 'missing_docs'
- Used for throttling logic

// Conversation
- Used to group messages per case
- unreadCount updated when incoming SMS

// ChecklistItem
- status: MISSING (queried for missing docs)
- template.isRequired: Only required items included
```

## Deployment Checklist

- [x] Notification service implemented
- [x] Auto-welcome SMS on client creation
- [x] Blurry notification from AI pipeline
- [x] Reminder endpoints (single + batch)
- [x] Throttling logic in place (1h blurry, 24h missing)
- [x] Grace period for new cases (3 days)
- [x] Exports in SMS service index
- [ ] Set up cron job for batch reminders
- [ ] Test endpoint: POST /messages/remind-batch
- [ ] Monitor SMS logs for throttling effectiveness
- [ ] Add API authentication if needed

## Testing

### Unit Test: Single Reminder

```typescript
it('sends missing docs reminder with 24h throttle', async () => {
  const result = await notifyMissingDocuments(caseId)

  expect(result.success).toBe(true)
  expect(result.smsSent).toBe(true)
  expect(result.messageId).toBeDefined()

  // Second call within 24h should be throttled
  const result2 = await notifyMissingDocuments(caseId)
  expect(result2.error).toBe('THROTTLED')
  expect(result2.smsSent).toBe(false)
  expect(result2.success).toBe(true) // Still success, just throttled
})
```

### Integration Test: Batch Reminders

```typescript
it('sends batch reminders with concurrency control', async () => {
  // Create 10 eligible cases (WAITING_DOCS, missing items, no recent SMS)
  const cases = await createTestCases(10)

  const result = await sendBatchMissingReminders()

  expect(result.sent).toBeGreaterThan(0)
  expect(result.failed).toBe(0)
  expect(result.skipped).toBe(0)
  expect(result.details).toHaveLength(10)
})
```

## Monitoring

### Metrics to Track

1. **Welcome SMS Success Rate**
   - Total clients created
   - SMS sent / SMS failed

2. **Blurry Notification Effectiveness**
   - Blurry docs detected
   - SMS sent / Throttled

3. **Missing Docs Reminder Coverage**
   - Eligible cases
   - SMS sent / Throttled / Failed

4. **Batch Job Health**
   - Total cases per run
   - Sent / Failed / Skipped
   - Average processing time

### Logging Points

- Successful sends logged with messageId
- Throttling logged (to track if excessive)
- Errors logged with context
- Batch job logs summary after completion

## Limitations & Future

### Current Limitations
- No SMS read receipts
- No scheduling (always immediate)
- No message retry if Twilio down
- Single magic link per case

### Future Enhancements (Phase 3.2+)
- SMS delivery status tracking
- Scheduled message sending
- Retry mechanism with backoff
- Multiple contact points per client
- Customizable throttle windows (staff configurable)
- SMS performance dashboard

## Files & Structure

```
apps/api/src/
├── services/sms/
│   ├── notification-service.ts      # NEW: Auto-notify orchestration
│   ├── message-sender.ts            # Existing: High-level SMS send
│   └── index.ts                     # Updated: Export notification service
├── routes/
│   ├── clients/index.ts             # Updated: Welcome SMS on creation
│   └── messages/index.ts            # Updated: Remind endpoints
└── services/ai/
    └── document-pipeline.ts         # Updated: Blurry SMS trigger
```

---

**Last Updated:** 2026-01-13 23:18
**Phase:** 3.1 Second Half - Automated Notifications
**Files Created:** 1 (notification-service.ts)
**Files Modified:** 4 (clients route, messages route, document-pipeline, sms/index.ts)
**Next Phase:** 3.2 - SMS Status Tracking & Delivery Reporting
