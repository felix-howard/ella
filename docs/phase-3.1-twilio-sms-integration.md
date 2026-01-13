# Phase 3.1 - Twilio SMS Integration (First Half)

**Status:** Complete - 2026-01-13
**Branch:** feature/phase-3-communication

## Overview

Phase 3.1 integrates Twilio SMS to enable two-way SMS communication with tax clients. Outbound messages notify clients about document status, missing documents, and completion. Inbound messages are captured and create staff action items.

**Key Features:**
- Outbound SMS with Vietnamese template messages
- Webhook handler for incoming SMS
- Database message tracking (SMS, Portal, System)
- E.164 phone number formatting
- Signature validation for webhook security
- Rate limiting (60 req/min/IP)
- Duplicate message prevention

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│        Twilio Service Layer                              │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  twilio-client.ts          message-sender.ts            │
│  ├─ getTwilioClient()      ├─ sendWelcomeMessage()    │
│  ├─ sendSms()             ├─ sendMissingDocsReminder() │
│  ├─ isValidPhoneNumber()  ├─ sendBlurryResendRequest()│
│  └─ formatPhoneToE164()   ├─ sendDocsCompleteMessage()│
│                           ├─ sendCustomMessage()      │
│                           └─ sendAndRecordMessage()   │
│                                                        │
│  Templates                 webhook-handler.ts         │
│  ├─ welcome.ts            ├─ validateTwilioSignature()│
│  ├─ missing-docs.ts       ├─ processIncomingMessage() │
│  ├─ blurry-resend.ts      ├─ sanitizeMessageContent() │
│  ├─ complete.ts           ├─ generateTwimlResponse()  │
│  └─ index.ts              └─ escapeXml()             │
│                                                        │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ↓                             ↓
    [Twilio SDK]                 [Webhook Handler]
    (send SMS)                   (receive SMS)
          ↓                             ↑
    ┌─────────────────────────────────────────┐
    │      Hono API Routes                     │
    │  ├─ POST /webhooks/twilio/sms          │
    │  └─ POST /webhooks/twilio/status       │
    └────────────────┬─────────────────────────┘
                     ↓
            [PostgreSQL Database]
            ├─ Message (SMS, Portal, System)
            ├─ Conversation (thread tracking)
            ├─ TaxCase (lastContactAt)
            └─ Action (CLIENT_REPLIED events)
```

## Twilio Client Wrapper

**File:** `apps/api/src/services/sms/twilio-client.ts`

Low-level SMS sending with retry logic and phone formatting.

### Key Functions

#### getTwilioClient()
Returns singleton Twilio client instance (initialized once per process).

```typescript
const client = getTwilioClient() // Throws if not configured
```

#### sendSms(options)
Sends SMS via Twilio with exponential backoff retry (2 retries, 500ms base delay).

**Parameters:**
- `to: string` - Recipient phone (any format, normalized to E.164)
- `body: string` - Message content (≤1600 chars)
- `statusCallback?: string` - Optional webhook URL for delivery status

**Returns:**
```typescript
{
  success: boolean
  sid?: string           // Twilio message SID
  status?: string       // 'queued', 'sent', 'delivered', etc.
  error?: string        // Error code if failed
}
```

**Retry Strategy:**
- Transient errors (500, 502, 503, timeouts) → Retry with backoff
- Non-transient errors (21211 invalid number, 21614 unverified) → Single attempt
- Max 2 retries total (3 attempts)

#### formatPhoneToE164(phone)
Normalizes phone to E.164 format (+1XXXXXXXXXX for US numbers).

**Logic:**
1. Remove non-digit chars (except leading +)
2. If no +, assume US (+1)
3. Handle leading 1 for US numbers (11 digit → 10 digit + +1)

```typescript
formatPhoneToE164('555-123-4567')      // '+15551234567'
formatPhoneToE164('(555) 123-4567')    // '+15551234567'
formatPhoneToE164('+1 555 123 4567')   // '+15551234567'
formatPhoneToE164('+44123456789')      // '+44123456789' (int'l)
```

#### isValidPhoneNumber(phone)
Validates E.164 format: `+[1-9][0-9]{9,14}` (10-15 digits total).

## Message Sender Service

**File:** `apps/api/src/services/sms/message-sender.ts`

High-level service for sending templated SMS with database tracking.

### Template-Based Messaging

#### sendWelcomeMessage()
Sends welcome SMS with magic link to new client.

```typescript
const result = await sendWelcomeMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  taxYear: number,
  language: 'VI' | 'EN' = 'VI'
)
```

**Vietnamese Template:**
```
Xin chào Nguyễn Văn A,

Chúng tôi đã tạo tài khoản cho quý vị để nộp hóa đơn cho năm 2025.

Vui lòng truy cập: [magic_link]

Cảm ơn,
Ella Accounting
```

#### sendMissingDocsReminder()
Reminds client about missing required documents.

```typescript
const result = await sendMissingDocsReminder(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  missingDocs: string[],      // Document type names
  language: 'VI' | 'EN' = 'VI'
)
```

**Vietnamese Template:**
```
Xin chào Nguyễn Văn A,

Chúng tôi còn cần các tài liệu sau:
- W2 (Thu nhập từ công việc)
- 1099-NEC (Thu nhập tự do)

Vui lòng tải lên: [magic_link]

Cảm ơn,
Ella Accounting
```

#### sendBlurryResendRequest()
Requests client to resend blurry/unclear document images.

```typescript
const result = await sendBlurryResendRequest(
  caseId: string,
  clientName: string,
  clientPhone: string,
  magicLink: string,
  docTypes: string[],         // Document types that are blurry
  language: 'VI' | 'EN' = 'VI'
)
```

**Vietnamese Template:**
```
Xin chào Nguyễn Văn A,

Ảnh của bạn không rõ ràng. Vui lòng tải lên lại:
- W2 (Thu nhập từ công việc)

Truy cập: [magic_link]

Cảm ơn,
Ella Accounting
```

#### sendDocsCompleteMessage()
Notifies client that all documents received and processing started.

```typescript
const result = await sendDocsCompleteMessage(
  caseId: string,
  clientName: string,
  clientPhone: string,
  taxYear: number,
  language: 'VI' | 'EN' = 'VI'
)
```

**Vietnamese Template:**
```
Xin chào Nguyễn Văn A,

Chúng tôi đã nhận tất cả tài liệu cho năm 2025.

Chúng tôi sẽ xử lý và liên hệ lại với bạn sớm nhất.

Cảm ơn,
Ella Accounting
```

### Return Type

All functions return:
```typescript
{
  success: boolean           // Operation succeeded
  messageId?: string        // Database message ID
  smsSent: boolean          // SMS actually sent (if Twilio configured)
  error?: string            // Error description if failed
}
```

### Database Tracking

Each message creates a record in `Message` table:

```prisma
Message {
  id: String          // UUID
  conversationId      // Links to Conversation
  channel: 'SMS'      // Message type
  direction: 'OUTBOUND'
  content: String     // Full message text
  templateUsed: 'welcome' | 'missing_docs' | 'blurry_resend' | 'complete'
  twilioSid?: String  // Twilio message identifier
  twilioStatus?: String
  createdAt: DateTime
}
```

Also updates:
- `Conversation.lastMessageAt` → Timestamp of latest message
- `TaxCase.lastContactAt` → Last contact with client (for compliance)

## SMS Webhook Handler

**File:** `apps/api/src/services/sms/webhook-handler.ts`

Processes incoming SMS from Twilio, finds associated client/case, and creates action item.

### Signature Validation

#### validateTwilioSignature()
HMAC-SHA1 timing-safe comparison prevents replay attacks.

```typescript
function validateTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string
): SignatureValidationResult
```

**Security Details:**
- Uses crypto.timingSafeEqual() (prevents timing attacks)
- Rejects requests if TWILIO_AUTH_TOKEN missing in production
- Dev mode: Logs warning but allows bypass
- Returns `{ valid: true/false, error?: string }`

**Implementation:**
1. Sort params alphabetically
2. Concatenate: URL + sorted param key-value pairs
3. Calculate HMAC-SHA1 with TWILIO_AUTH_TOKEN
4. Compare base64 signatures via timing-safe comparison

### Message Processing

#### processIncomingMessage()
Core handler for incoming SMS.

**Parameters:**
```typescript
TwilioIncomingMessage {
  MessageSid: string          // Unique Twilio identifier
  AccountSid: string          // Account identifier
  From: string               // Sender phone number
  To: string                 // Recipient (Twilio number)
  Body: string               // Message content
  NumMedia?: string          // Count of media attachments
  MediaUrl0?: string         // First media URL (future support)
  MediaContentType0?: string // Media type
}
```

**Processing Steps:**

1. **Sanitization:** Remove control chars, limit to 1600 chars
2. **Duplicate Prevention:** Check if MessageSid exists (replay attack protection)
3. **Client Lookup:** Find client by phone number (exact match, E.164, normalized)
4. **Case Selection:** Use client's latest TaxCase (assume current year)
5. **Message Recording:** Create Message record (INBOUND, SMS channel)
6. **Conversation Update:** Increment unreadCount, update lastMessageAt
7. **Action Creation:** Create CLIENT_REPLIED action (NORMAL priority)
8. **Staff Notification:** Action appears in staff dashboard queue

**Returns:**
```typescript
{
  success: boolean
  messageId?: string         // Database message ID
  caseId?: string           // Associated tax case
  actionCreated?: boolean   // Action created for staff
  error?: string            // Error code if failed
}
```

**Error Codes:**
- `EMPTY_MESSAGE` - Content empty after sanitization
- `DUPLICATE_MESSAGE` - MessageSid already exists
- `CLIENT_NOT_FOUND` - No client with matching phone
- `NO_TAX_CASE` - Client has no tax cases

### Client Lookup

Phone matching tries 3 formats (in order):
1. Exact match (how it was stored)
2. E.164 format: `+1XXXXXXXXXX`
3. Normalized: `XXXXXXXXXX` (digits only, no country code)

This handles various input formats from Twilio:
- `+15551234567` (E.164)
- `15551234567` (with country code)
- `5551234567` (10 digits)

### TwiML Response

#### generateTwimlResponse()
Generates XML response for Twilio (prevents auto-replies).

```typescript
function generateTwimlResponse(message?: string): string
```

Returns empty TwiML (no auto-reply):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<Response></Response>
```

## Webhook Route Handler

**File:** `apps/api/src/routes/webhooks/twilio.ts`

Hono route handlers for Twilio integration.

### Rate Limiting

In-memory rate limiter: 60 requests/minute/IP

```typescript
const RATE_LIMIT_WINDOW_MS = 60000      // 1 minute window
const RATE_LIMIT_MAX_REQUESTS = 60      // Max requests per window per IP
```

**Returns 429** if limit exceeded. Cleans up old entries every 60 seconds.

### Endpoints

#### POST /webhooks/twilio/sms
Handles incoming SMS messages.

**Request:** Form-urlencoded from Twilio

**Headers Required:**
- `X-Twilio-Signature` - Signature for validation

**Flow:**
1. Check rate limit (60 req/min/IP)
2. Validate signature
3. Parse form data
4. Process incoming message
5. Return TwiML XML response

**Response:** 200 OK with TwiML
- Signature validation failure → 403 Forbidden
- Rate limit exceeded → 429 Too Many Requests

#### POST /webhooks/twilio/status
(Optional) Tracks delivery status of outbound messages.

**Request:** Status update from Twilio

**Returns:** JSON `{ received: true }`

**Note:** Implementation minimal (logs only). Future: Update Message.twilioStatus.

## Configuration

### Environment Variables

Add to `.env`:

```bash
# Twilio Configuration (Phase 3.1)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890

# For development/testing only (not recommended for production)
# TWILIO_DEBUG_MODE=true
```

### Config Loading

**File:** `apps/api/src/lib/config.ts`

```typescript
export const config = {
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    phoneNumber: process.env.TWILIO_PHONE_NUMBER || '',
    isConfigured: !!(
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
    ),
  },
  // ... other configs
}
```

If any Twilio var missing: `isConfigured = false`
- Outbound messages logged but not sent
- Webhook handlers still work (for development)

## Message Templates

**Files:** `apps/api/src/services/sms/templates/*`

### Template Structure

Each template exports:
- Generator function: `generateXxxMessage(params)`
- Template name constant: `XXX_TEMPLATE_NAME`
- TypeScript interface: `XxxTemplateParams`

**Language Support:**
All templates support `language: 'VI' | 'EN'` parameter.

### Vietnamese-First Approach

- Default language: Vietnamese (VI)
- English (EN) fallback for international clients
- Field labels in template params (e.g., clientName, magicLink)
- Formatting handled by generator (line breaks, spacing)

## Integration Points

### 1. Client Onboarding

After creating client + case + magic link:

```typescript
await sendWelcomeMessage(
  caseId,
  client.name,
  client.phone,
  magicLink.token,
  case.taxYear
)
```

### 2. Missing Documents Reminder

After document deadline or user request:

```typescript
await sendMissingDocsReminder(
  caseId,
  client.name,
  client.phone,
  magicLink.token,
  ['W2', 'FORM_1099_NEC'] // Array of doc type labels
)
```

### 3. Blur Detection

After AI pipeline detects blurry images:

```typescript
await sendBlurryResendRequest(
  caseId,
  client.name,
  client.phone,
  magicLink.token,
  ['W2'] // Blurry document types
)
```

### 4. Completion Notification

After all documents verified:

```typescript
await sendDocsCompleteMessage(
  caseId,
  client.name,
  client.phone,
  case.taxYear
)
```

### 5. Incoming Message Handling

Webhook automatically:
- Records incoming SMS
- Finds associated case
- Creates CLIENT_REPLIED action
- Marks conversation unread
- Updates lastContactAt timestamp

Staff sees action in dashboard queue (NORMAL priority).

## Database Schema

### Message Model

```prisma
model Message {
  id                String      @id @default(cuid())
  conversationId    String
  conversation      Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  channel           MessageChannel  // SMS, PORTAL, SYSTEM
  direction         MessageDirection // INBOUND, OUTBOUND
  content           String      @db.Text
  attachmentUrls    String[]    @default([])
  isSystem          Boolean     @default(false)
  templateUsed      String?     // 'welcome', 'missing_docs', etc.
  twilioSid         String?     @unique // Twilio message identifier
  twilioStatus      String?     // 'queued', 'sent', 'failed', etc.
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt
}

enum MessageChannel {
  SMS      // SMS via Twilio
  PORTAL   // Web portal message
  SYSTEM   // Automated system notification
}

enum MessageDirection {
  INBOUND   // Client → Staff
  OUTBOUND  // Staff → Client
}
```

### Conversation Model

```prisma
model Conversation {
  id            String    @id @default(cuid())
  caseId        String    @unique
  taxCase       TaxCase   @relation(fields: [caseId], references: [id], onDelete: Cascade)
  messages      Message[]
  unreadCount   Int       @default(0)
  lastMessageAt DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}
```

## Security Considerations

### 1. Signature Validation
- All incoming webhook requests validated via HMAC-SHA1
- Timing-safe comparison prevents timing attacks
- Production: Rejects requests without valid signature
- Development: Allows bypass with warning log

### 2. Message Sanitization
- Control characters removed (except newlines/tabs)
- Content length limited to 1600 chars (SMS limit)
- XSS protection via XML escaping in TwiML

### 3. Duplicate Prevention
- Incoming messages checked by MessageSid
- Prevents replay attacks (same message sent twice)
- Returns success without reprocessing duplicates

### 4. Phone Number Normalization
- Accepts multiple formats (E.164, with/without country code)
- Validates before Twilio sending (E.164 format required)
- Non-standard formats logged for debugging

### 5. Rate Limiting
- 60 requests/minute/IP on webhook endpoints
- Prevents SMS flood attacks
- Returns 429 Too Many Requests if exceeded

### 6. No Secrets in Logs
- Auth tokens never logged
- MessageSids logged for tracking only
- Phone numbers logged in debug context only

## Error Handling

### Twilio Send Failures

**Transient (Retry):**
- Network timeout
- 500/502/503 errors
- Rate limit (429)

**Non-Transient (No Retry):**
- 21211: Invalid 'To' phone number
- 21614: 'To' number not verified
- 21408: SMS permission not enabled

### Webhook Processing

Returns 200 OK even if processing fails (prevents Twilio retries).

**Logging:**
- Success: Message ID and case ID logged
- Failure: Error code logged with context
- All errors caught to prevent webhook crashes

## Testing

### Mock Twilio Responses

```typescript
jest.mock('twilio', () => ({
  __esModule: true,
  default: () => ({
    messages: {
      create: jest.fn().mockResolvedValue({
        sid: 'SM_test_123',
        status: 'sent'
      })
    }
  })
}))
```

### Integration Test Example

```typescript
it('sends welcome message and creates database record', async () => {
  const result = await sendWelcomeMessage(
    caseId,
    'Nguyễn Văn A',
    '5551234567',
    'https://example.com/u/token123',
    2025
  )

  expect(result.success).toBe(true)
  expect(result.messageId).toBeDefined()
  expect(result.smsSent).toBe(isTwilioConfigured())

  // Verify database record
  const msg = await prisma.message.findUnique({
    where: { id: result.messageId }
  })
  expect(msg?.channel).toBe('SMS')
  expect(msg?.direction).toBe('OUTBOUND')
  expect(msg?.templateUsed).toBe('welcome')
})
```

## Deployment Checklist

- [ ] Obtain Twilio Account SID, Auth Token, Phone Number
- [ ] Add to production `.env` (deploy service credentials)
- [ ] Run migrations (if Message schema changes)
- [ ] Test signature validation in production
- [ ] Set Twilio webhook URL to: `https://api.example.com/webhooks/twilio/sms`
- [ ] Configure Twilio status callback (optional): `https://api.example.com/webhooks/twilio/status`
- [ ] Monitor webhook logs for errors
- [ ] Test incoming SMS with actual phone number
- [ ] Verify rate limiting works (stress test)
- [ ] Monitor Twilio usage dashboard

## Limitations & Future Enhancements

### Current Limitations
- Outbound SMS only (no MMS support)
- Single phone number per client (no backup contact)
- No scheduled messages
- Rate limiter in-memory (resets on server restart)
- Message status updates logged but not persisted

### Phase 3.2+ Roadmap
- Message delivery status tracking
- MMS support (images, documents)
- Scheduled message sending
- Redis-based rate limiting (distributed)
- Message templates in database (staff-configurable)
- SMS read receipts
- Multi-phone number support

## Files & Structure

```
apps/api/src/
├── services/sms/
│   ├── index.ts                    # Public exports
│   ├── twilio-client.ts            # Low-level API wrapper
│   ├── message-sender.ts           # High-level send service
│   ├── webhook-handler.ts          # Incoming message processor
│   └── templates/
│       ├── index.ts                # Template exports
│       ├── welcome.ts              # Welcome message
│       ├── missing-docs.ts         # Missing docs reminder
│       ├── blurry-resend.ts        # Blurry image request
│       └── complete.ts             # Completion notification
└── routes/webhooks/
    ├── index.ts                    # Webhook route setup
    └── twilio.ts                   # Twilio endpoints
```

---

**Last Updated:** 2026-01-13 22:30
**Phase:** 3.1 - Twilio SMS Integration (First Half, Complete)
**Files Created:** 9 (twilio-client, message-sender, webhook-handler, 4 templates, 2 route handlers)
**Next Phase:** 3.2 - SMS Status Tracking & MMS Support
