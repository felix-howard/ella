# Scout Report: Upload Link Feature & Client Creation Flow

**Date:** 2026-03-31  
**Focus:** Upload link generation, sending, and client creation flows

## 1. Upload Link Generation & Sending

### 1.1 Backend Endpoint: POST /clients/:id/send-upload-link
**File:** apps/api/src/routes/clients/index.ts (lines 1300-1374)

**Flow:**
1. Client makes POST request with optional customMessage
2. Fetches client and their latest tax case
3. Calls createMagicLink(caseId) to generate portal URL
4. Calls sendWelcomeMessage() with portal URL
5. Returns { success: true, messageId }

### 1.2 Magic Link Service
**File:** apps/api/src/services/magic-link.ts

**Key Functions:**
- createMagicLink(caseId) - Creates magic link with 12-char URL-safe token
- getMagicLinkUrl(token, type) - Generates URL

**Magic Link Types:**
- PORTAL: https://portal.ellatax.com/u/{token}
- SCHEDULE_C: https://portal.ellatax.com/expense/{token}
- SCHEDULE_E: https://portal.ellatax.com/rental/{token}
- DRAFT_RETURN: https://portal.ellatax.com/draft/{token}

**Expiry:** Magic links NEVER expire (expiresAt = null)

### 1.3 SMS Message Sending
**File:** apps/api/src/services/sms/message-sender.ts

Function: sendWelcomeMessage()
- Sends SMS with portal link
- Supports custom message override
- Logs delivery status

## 2. Frontend: Send Upload Link UI

### 2.1 Modal Component
**File:** apps/workspace/src/components/shared/send-upload-link-modal.tsx

Features:
- Language toggle (VI/EN)
- Editable message template
- Placeholder guide for {{client_name}}, {{tax_year}}, {{portal_link}}
- Loading state during send

### 2.2 Client Detail Page Integration
**File:** apps/workspace/src/routes/clients/$clientId.tsx (lines 630-851)

**Button Location:** Lines 630-639
- Shows only when NO active portal link
- Icon: Send (Lucide)
- Opens SendUploadLinkModal

**Mutation Handler:** Lines 178-228
- Optimistic update: adds temp message immediately
- Invalidates queries on success
- Rate limited: 5 requests per 60 seconds

## 3. hasUploadLink Field

### 3.1 Data Model
**File:** packages/db/prisma/schema.prisma

MagicLink Model:
- id, caseId, token (unique)
- type: PORTAL | SCHEDULE_C | SCHEDULE_E | DRAFT_RETURN
- isActive, expiresAt (null = never)
- lastUsedAt, usageCount

### 3.2 hasUploadLink Computation
**File:** apps/api/src/routes/clients/index.ts (line 285)

Logic: hasUploadLink: latestCase ? latestCase._count.magicLinks > 0 : false

NOT stored in DB - computed dynamically from MagicLinks count

## 4. Client Creation Flows

### 4.1 From Registration Form (Public)
**File:** apps/api/src/routes/leads/index.ts (lines 43-85)

Endpoint: POST /leads
- Creates Lead record (not Client yet)
- firstName, lastName, phone, email
- businessName, campaignTag, tags
- status: NEW

### 4.2 From Incoming SMS (New Caller)
**File:** apps/api/src/services/sms/webhook-handler.ts (lines 135-313)

Function: processIncomingMessage()

Flow for unknown caller:
1. Twilio webhook receives SMS from unknown phone
2. Looks up client by phone
3. If NOT found:
   - Creates placeholder conversation
   - Atomically creates: Client, TaxCase, Conversation
   - Client name initially = phone number
4. Stores message
5. Creates HIGH priority action marked as unknown caller
6. Returns { isUnknownCaller: true }

### 4.3 From Incoming Call (New Caller)
**File:** apps/api/src/routes/webhooks/twilio.ts (lines 482-654)

Endpoint: POST /webhooks/twilio/voice/incoming

Flow:
1. Receives incoming call from Twilio
2. Looks up client by From (caller phone)
3. If NOT found:
   - Creates placeholder conversation
   - Routes to voicemail if no staff online
   - Creates inbound call message
4. If found:
   - Routes to managing staff or admins

## 5. Client Source Tracking

**File:** packages/db/prisma/schema.prisma

Client.source enum:
- MANUAL - Created by staff
- FORM - From registration form
- INCOMING_CALL - From inbound call
- INCOMING_SMS - From inbound SMS

## 6. API Client Methods (Frontend)

**File:** apps/workspace/src/lib/api-client.ts (lines 264-266)

```typescript
clients: {
  sendUploadLink: (id: string, customMessage?: string) =>
    request(`/clients/${id}/send-upload-link`, {
      method: 'POST',
      body: customMessage ? { customMessage } : undefined,
    })
}
```

## 7. Key Files Summary

| Component | File | Lines |
|-----------|------|-------|
| Backend Endpoint | apps/api/src/routes/clients/index.ts | 1300-1374 |
| Magic Link Service | apps/api/src/services/magic-link.ts | all |
| SMS Webhook Handler | apps/api/src/services/sms/webhook-handler.ts | 135-313 |
| Twilio Voice Webhook | apps/api/src/routes/webhooks/twilio.ts | 482-654 |
| Modal Component | apps/workspace/src/components/shared/send-upload-link-modal.tsx | all |
| Client Detail Page | apps/workspace/src/routes/clients/$clientId.tsx | 630-851 |
| API Client | apps/workspace/src/lib/api-client.ts | 264-266 |
| Database Schema | packages/db/prisma/schema.prisma | Client, TaxCase, MagicLink |
| Leads Routes | apps/api/src/routes/leads/index.ts | 43-85 |
| Webhook Route | apps/api/src/routes/webhooks/twilio.ts | all |

## 8. Key Insights

1. **hasUploadLink:** Computed from _count.magicLinks > 0, not stored
2. **Magic Links:** Never expire (changed from 7-day TTL)
3. **Unknown Caller:** Auto-creates placeholder with HIGH priority for staff
4. **Message Customization:** Staff can override template with custom text
5. **Optimistic Updates:** Frontend shows message before confirmation
6. **Rate Limiting:** 5 requests per 60 seconds per user
7. **Token Format:** 12-char URL-safe (nanoid alphabet: 0-9a-z)

