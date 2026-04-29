# Scout Report: Bulk SMS/Message Functionality

Generated: 2026-03-30

## Summary

Located all files for bulk SMS sending to leads, message history storage in case conversations, and database models tracking both channels.

---

## 1. Bulk SMS Sending (Leads)

### API Endpoint
File: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/leads/index.ts`
Route: POST /leads/bulk-sms (lines 401-517)

Features:
- Requires org admin auth + Twilio configured
- Accepts array of lead IDs, message with placeholders
- Placeholders: {{firstName}}, {{formLink}}
- Supports org or staff-specific form links
- Batches 10 SMS at a time
- Creates SmsSendLog record for each SMS

### Frontend Component
File: `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/bulk-sms-dialog.tsx`

Features:
- Dialog with textarea for message composition
- Placeholder buttons for firstName and formLink
- Character count with 160-char warning
- Preview for first selected lead
- Staff dropdown for staff form link selection

---

## 2. Message History (Case/Client Channel)

### API Endpoints
File: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/messages/index.ts`

Routes:
- GET /messages/conversations - List all conversations (unified inbox)
- GET /messages/:caseId - Get conversation + message history for case
- POST /messages/send - Send message to client
- GET /messages/media/:messageId/:index - Attachment proxy endpoint

Key features:
- Creates Conversation record per case
- Creates Message record for each SMS (tracks direction, channel, twilioSid, twilioStatus)
- Auto-repairs R2 attachment keys on fetch
- Tracks unread count per conversation

### Lead Detail Drawer
File: `/c/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/lead-detail-drawer.tsx`

Lines 393-402: Message History section (currently placeholder)
- Shows placeholder UI with MessageSquare icon
- No integration to SmsSendLog yet

---

## 3. Database Models

### SmsSendLog (Bulk SMS to Leads)
Location: `/c/Users/Admin/Desktop/ella/packages/db/prisma/schema.prisma`

Fields:
- id, message (text), status (SmsSendStatus)
- twilioSid, error
- leadId, sentById, organizationId
- sentAt (timestamp)

Relations:
- lead: Lead (onDelete: Cascade)
- sentBy: Staff ("SentSmsLogs")
- organization: Organization (onDelete: Cascade)

Lead detail endpoint fetches last 20 SMS logs via smsSendLogs relation.

### Message & Conversation (Case Chat)
Location: `/c/Users/Admin/Desktop/ella/packages/db/prisma/schema.prisma`

Models:
- Conversation: caseId, unreadCount, lastMessageAt
- Message: conversationId, channel (SMS/SYSTEM), direction (INBOUND/OUTBOUND)
  - Fields: twilioSid, twilioStatus, attachmentR2Keys, attachmentUrls, templateUsed, sentById

---

## 4. API Validation Schemas

### Bulk SMS Schema
File: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/leads/schemas.ts` (lines 52-58)

```
leadIds: array of cuid, min 1, max 100
message: string, min 1, max 500
formLinkType: enum ['org', 'staff'], default 'org'
staffSlug: optional string
```

### Send Message Schema
File: `/c/Users/Admin/Desktop/ella/apps/api/src/routes/messages/schemas.ts` (lines 7-12)

```
caseId: string, min 1
content: string, min 1, max 1000
channel: enum ['SMS', 'SYSTEM'], default 'SMS'
templateName: optional string
```

---

## 5. SMS Service

File: `/c/Users/Admin/Desktop/ella/apps/api/src/services/sms/message-sender.ts`

Key functions:
- sendSmsOnly(phone, content) - SMS without creating message record (bulk leads)
- sendAndRecordMessage(caseId, phone, content, templateName) - SMS + Message record (cases)
- sendWelcomeMessage(), sendMissingDocsReminder(), etc. (templated messages)

Critical: Failed SMS recorded with `ERROR: {error}` status (lines 250-252)

---

## 6. Data Flow: Bulk SMS

1. User selects leads → opens BulkSmsDialog
2. Composes message with placeholders
3. Submits to POST /leads/bulk-sms
4. Backend validates leads belong to org
5. For each lead in batches of 10:
   - Replace {{firstName}}, {{formLink}}
   - Call sendSmsOnly() → Twilio
   - Create SmsSendLog record (SENT or FAILED)
   - Update lead status: NEW → CONTACTED if success
6. Return summary: {sent, failed, errors}
7. Frontend invalidates leads cache

---

## 7. Data Flow: Case Messages

1. Staff opens case conversation
2. GET /messages/:caseId fetches Conversation + paginated Messages
3. Auto-creates Conversation via upsert if needed
4. Returns messages with sentBy, attachmentUrls (proxied), twilioStatus
5. Resets unreadCount to 0 on fetch

---

## 8. Key Files

Backend:
- /c/Users/Admin/Desktop/ella/apps/api/src/routes/leads/index.ts
- /c/Users/Admin/Desktop/ella/apps/api/src/routes/leads/schemas.ts
- /c/Users/Admin/Desktop/ella/apps/api/src/routes/messages/index.ts
- /c/Users/Admin/Desktop/ella/apps/api/src/routes/messages/schemas.ts
- /c/Users/Admin/Desktop/ella/apps/api/src/services/sms/message-sender.ts

Frontend:
- /c/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/bulk-sms-dialog.tsx
- /c/Users/Admin/Desktop/ella/apps/workspace/src/components/leads/lead-detail-drawer.tsx

Database:
- /c/Users/Admin/Desktop/ella/packages/db/prisma/schema.prisma

---

## 9. Unresolved Questions

1. Message history in lead drawer (line 393-402) is placeholder only. Should it show SmsSendLog history?

2. SmsSendStatus enum definition not found in grep - confirm SENT/FAILED values in schema.

3. Two separate tracking systems exist (SmsSendLog for bulk, Message for cases). Should they be unified?

---

