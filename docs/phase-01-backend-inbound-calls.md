# Phase 01: Backend Foundation - Inbound Call Handling

**Status:** Completed 2026-01-21
**Branch:** feature/enhance-call
**Focus:** Backend infrastructure for incoming calls (staff presence tracking, caller lookup, rate limiting)

## Overview

Phase 01 establishes the foundation for inbound call handling by enabling:
1. **Staff Presence Tracking** - Register/unregister staff online status for incoming calls
2. **Presence Heartbeat** - Keep presence alive with periodic updates
3. **Caller Information Lookup** - Retrieve caller context from phone number
4. **Rate Limiting** - Prevent abuse on high-frequency endpoints
5. **Inbound Call Support** - Enable incoming calls via Twilio VoiceGrant

This phase prepares the backend for Phase 02 (Frontend Incoming Call UI) and Phase 03 (Call Routing & Distribution).

## Database Changes

### New Model: StaffPresence

Added to `packages/db/prisma/schema.prisma`:

```prisma
model StaffPresence {
  id        String   @id @default(cuid())
  staffId   String   @unique
  staff     Staff    @relation(fields: [staffId], references: [id], onDelete: Cascade)
  isOnline  Boolean  @default(false)
  deviceId  String?  // Twilio device identity: staff_{staffId}
  lastSeen  DateTime @default(now())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([isOnline])
}
```

**Purpose:** Track which staff members are online and available for incoming calls.

**Fields:**
- `staffId` - Unique reference to Staff (cascade delete on staff removal)
- `isOnline` - Boolean flag indicating current online status
- `deviceId` - Twilio device identity used for call routing (format: `staff_{staffId}`)
- `lastSeen` - Timestamp of last activity (register/heartbeat)
- `createdAt/updatedAt` - Lifecycle timestamps
- Index on `isOnline` - For efficient "get all online staff" queries

**Cardinality:** One-to-One with Staff (one staff = one presence record)

## API Endpoints

### 1. POST /voice/presence/register

**Purpose:** Register staff device as online for incoming calls.

**When Called:**
- Frontend: Device.on('registered') event fires after successful token initialization
- Frequency: Once per session/tab

**Request:**
```
POST /voice/presence/register
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "success": true,
  "deviceId": "staff_user123"
}
```

**Database Impact:**
```typescript
await prisma.staffPresence.upsert({
  where: { staffId: user.staffId },
  create: {
    staffId: user.staffId,
    isOnline: true,
    deviceId: `staff_${user.staffId}`,
    lastSeen: new Date(),
  },
  update: {
    isOnline: true,
    deviceId: `staff_${user.staffId}`,
    lastSeen: new Date(),
  },
})
```

**Error Responses:**
- `401 UNAUTHORIZED` - No staff authentication
- `500 OPERATION_FAILED` - Database error

**Rate Limit:** 30 requests/minute (presence-specific)

---

### 2. POST /voice/presence/unregister

**Purpose:** Mark staff as offline (not available for incoming calls).

**When Called:**
- Frontend: Device.on('unregistered') event OR tab closes
- Frequency: Once per session end

**Request:**
```
POST /voice/presence/unregister
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "success": true
}
```

**Database Impact:**
```typescript
await prisma.staffPresence.upsert({
  where: { staffId: user.staffId },
  create: {
    staffId: user.staffId,
    isOnline: false,
    lastSeen: new Date(),
  },
  update: {
    isOnline: false,
    lastSeen: new Date(),
  },
})
```

**Error Responses:**
- `401 UNAUTHORIZED` - No staff authentication
- `500 OPERATION_FAILED` - Database error

**Rate Limit:** 30 requests/minute (presence-specific)

**Important:** Unregister does not delete the record—it marks `isOnline = false` to preserve history.

---

### 3. POST /voice/presence/heartbeat

**Purpose:** Keep presence alive by updating `lastSeen` timestamp.

**When Called:**
- Frontend: Periodic heartbeat (e.g., every 30 seconds while Device is active)
- Frequency: Every 30-60 seconds during active session

**Request:**
```
POST /voice/presence/heartbeat
Authorization: Bearer <JWT>
```

**Response:**
```json
{
  "success": true
}
```

**Response (Staff Offline):**
```json
{
  "success": false,
  "reason": "NOT_ONLINE"
}
```

**Database Impact:**
```typescript
await prisma.staffPresence.updateMany({
  where: { staffId: user.staffId, isOnline: true },
  data: { lastSeen: new Date() },
})
```

**Error Responses:**
- `401 UNAUTHORIZED` - No staff authentication
- `500 OPERATION_FAILED` - Database error

**Rate Limit:** 30 requests/minute (presence-specific)

**Timeout Behavior:** Staff considered offline if `lastSeen > 2 minutes old` (backend application responsibility—not automatic)

---

### 4. GET /voice/caller/:phone

**Purpose:** Lookup caller information for incoming call UI (caller ID display).

**When Called:**
- Frontend/Backend: When incoming call arrives (before showing ring UI)
- Frequency: Once per incoming call

**Request:**
```
GET /voice/caller/+14155551234
Authorization: Bearer <JWT>
```

**Phone Format:** E.164 format required (`+[country][number]`)
Valid examples: `+14155551234`, `+441234567890`, `+8613800000000`

**Response (Known Caller):**
```json
{
  "phone": "+14155551234",
  "conversation": {
    "id": "conv_abc123",
    "caseId": "case_def456",
    "clientName": "John Smith"
  },
  "lastContactStaffId": null
}
```

**Response (Unknown Caller):**
```json
{
  "phone": "+14155551234",
  "conversation": null,
  "lastContactStaffId": null
}
```

**Error Responses:**
- `400 INVALID_PHONE` - E.164 format validation failed
- `401 UNAUTHORIZED` - No staff authentication
- `500 OPERATION_FAILED` - Database error

**Database Logic:**
```typescript
1. Find Client by phone
2. Get latest TaxCase for client (if exists)
3. Get Conversation for that case (if exists)
4. Find last OUTBOUND completed CALL message to determine routing staff
5. Return conversation context + last contact staff (currently null - future phase)
```

**Rate Limit:** 60 requests/minute (standard)

**Note:** `lastContactStaffId` returns `null` in Phase 01—will be implemented in Phase 02 (routing logic).

---

## Rate Limiting Middleware

### New File: apps/api/src/middleware/rate-limiter.ts

**Purpose:** In-memory rate limiting for sensitive endpoints.

**Features:**
- Per-user rate limiting (uses `staffId` if authenticated, fallback to IP)
- Configurable time windows and request limits
- Automatic cleanup of expired entries (every 60 seconds)

**Pre-configured Limiters:**

| Limiter | Config | Use Case |
|---------|--------|----------|
| `standardRateLimit` | 60 req/min | General API endpoints |
| `strictRateLimit` | 10 req/min | Sensitive operations |
| `presenceRateLimit` | 30 req/min | Presence (register/unregister/heartbeat) |

**Implementation:**

```typescript
export function checkRateLimit(
  key: string,
  windowMs: number = 60000,
  maxRequests: number = 60
): boolean
```

**Applied To:**
- `POST /voice/presence/register` - presenceRateLimit
- `POST /voice/presence/unregister` - presenceRateLimit
- `POST /voice/presence/heartbeat` - presenceRateLimit

**Storage:** In-memory Map (not persistent across server restarts)

---

## Voice Token Generator Changes

### File: apps/api/src/services/voice/token-generator.ts

**Change:** Enabled inbound calls via VoiceGrant

**Before:**
```typescript
const voiceGrant = new VoiceGrant({
  outgoingApplicationSid: config.twilio.twimlAppSid,
  // incomingAllow was false/undefined
})
```

**After:**
```typescript
const voiceGrant = new VoiceGrant({
  outgoingApplicationSid: config.twilio.twimlAppSid,
  incomingAllow: true, // Enable incoming calls to browser
})
```

**Impact:** Staff can now receive incoming calls from Twilio (Phase 02 frontend will display ring UI).

---

## Voice Routes Integration

### File: apps/api/src/routes/voice/index.ts

**New Endpoints Added:**

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/presence/register` | POST | Register staff online |
| `/presence/unregister` | POST | Mark staff offline |
| `/presence/heartbeat` | POST | Keep presence alive |
| `/caller/:phone` | GET | Lookup caller info |

**Existing Endpoints (Unchanged):**
- `POST /voice/token` - Generate access token
- `GET /voice/status` - Check feature availability
- `POST /voice/calls` - Create outbound call record
- `PATCH /voice/calls/:messageId` - Update with Twilio CallSid
- `GET /voice/recordings/:recordingSid` - Recording metadata
- `GET /voice/recordings/:recordingSid/audio` - Audio proxy stream

---

## Phone Number Validation

### E.164 Format Enforcement

All phone numbers validated using strict E.164 regex:

```typescript
/^\+[1-9]\d{9,14}$/
```

**Requirements:**
- Must start with `+`
- First digit after `+` cannot be 0 (E.164 standard)
- Total digits: 10-15 (after `+`)

**Examples:**
- ✅ `+14155551234` (US)
- ✅ `+441234567890` (UK)
- ✅ `+8613800000000` (China)
- ❌ `+01234567890` (invalid - starts with 0)
- ❌ `14155551234` (invalid - missing +)
- ❌ `+1234` (invalid - too few digits)

---

## Implementation Details

### Presence Flow

**Registration (Device.on('registered')):**
```
Frontend → POST /voice/presence/register
           ↓
Backend  → Upsert StaffPresence (isOnline=true, deviceId, lastSeen)
           ↓
Response → { success: true, deviceId: "staff_user123" }
```

**Heartbeat (Every 30 seconds):**
```
Frontend → POST /voice/presence/heartbeat
           ↓
Backend  → Update StaffPresence (lastSeen = now)
           ↓
Response → { success: true } or { success: false, reason: "NOT_ONLINE" }
```

**Unregistration (Device.on('unregistered') / tab closes):**
```
Frontend → POST /voice/presence/unregister
           ↓
Backend  → Upsert StaffPresence (isOnline=false, lastSeen)
           ↓
Response → { success: true }
```

### Caller Lookup Flow

**Incoming Call with Phone +14155551234:**
```
1. Get Staff (authenticated)
2. POST /voice/caller/+14155551234
3. Find Client where phone = "+14155551234"
4. Get latest TaxCase for Client
5. Get Conversation for TaxCase
6. Return { phone, conversation { id, caseId, clientName }, lastContactStaffId }
7. Frontend shows incoming call UI with client name (if known)
```

---

## Security Considerations

### Authentication
- All endpoints require valid JWT (`staffId` extracted from token)
- Returns `401 UNAUTHORIZED` if token missing or invalid

### Rate Limiting
- Presence endpoints limited to 30 req/min per staff member
- Prevents spam registration/unregistration
- Uses in-memory storage (simple, fast, no persistence)

### Input Validation
- Phone numbers validated against E.164 format
- Invalid format returns `400 BAD_REQUEST`
- Prevents SQL injection via RecordingSid-like lookups (though phone is not used in WHERE clause directly)

### Data Privacy
- Only authenticated staff can lookup caller info
- `lastContactStaffId` returns null (no staff attribution yet)
- No sensitive data in error messages

---

## Database Indexes

**StaffPresence Model:**
```prisma
@@index([isOnline])
```

**Query Optimization:**
- Fast "get all online staff" queries: `where { isOnline: true }`
- Useful for routing logic in future phases

---

## Performance Considerations

### In-Memory Rate Limiter
- **Pros:** Fast, no database queries
- **Cons:** Not shared across multiple server instances
- **Cleanup:** Automatic every 60 seconds
- **Memory Usage:** Minimal (1 entry per unique staffId/IP per window)

### Presence Queries
- `upsert` used for register/unregister (single query)
- `updateMany` used for heartbeat (efficient bulk update)
- Index on `isOnline` accelerates roster queries (Phase 02+)

### Caller Lookup
- 3 database queries (Client → TaxCase → Conversation)
- Could be optimized with JOIN in future
- No caching (always fresh)

---

## Error Handling

### Consistent Error Format
```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description (optional)"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Validation error (invalid phone, missing params)
- `401` - Authentication required
- `404` - Resource not found
- `429` - Rate limit exceeded
- `500` - Server/database error
- `503` - Service unavailable (voice not configured)

---

## Files Changed

### New Files (1)
- `apps/api/src/middleware/rate-limiter.ts` - Rate limiting middleware (87 LOC)

### Modified Files (3)
- `packages/db/prisma/schema.prisma` - Added StaffPresence model (12 LOC)
- `apps/api/src/services/voice/token-generator.ts` - Enabled `incomingAllow: true` (1 line)
- `apps/api/src/routes/voice/index.ts` - Added 4 new endpoints (200+ LOC)

---

## Testing Checklist

### Unit Tests
- [ ] Rate limiter blocks after max requests
- [ ] Rate limiter allows request after window reset
- [ ] StaffPresence upsert creates new record
- [ ] StaffPresence upsert updates existing record
- [ ] E.164 phone validation accepts valid formats
- [ ] E.164 phone validation rejects invalid formats
- [ ] Caller lookup finds known client
- [ ] Caller lookup returns null for unknown number
- [ ] Voice token generation includes `incomingAllow: true`

### Integration Tests
- [ ] POST /voice/presence/register creates StaffPresence record
- [ ] POST /voice/presence/heartbeat updates lastSeen
- [ ] POST /voice/presence/unregister sets isOnline = false
- [ ] GET /voice/caller/:phone returns conversation if exists
- [ ] GET /voice/caller/:phone returns null conversation if client not found
- [ ] Rate limit returns 429 after 30 requests/min to presence endpoints
- [ ] 401 returned without authentication
- [ ] 400 returned for invalid E.164 phone format

### Manual Tests
- [ ] Use Postman to verify presence endpoints
- [ ] Check database for StaffPresence records after registration
- [ ] Verify rate limit headers in response
- [ ] Test E.164 phone format edge cases
- [ ] Verify caller lookup with known and unknown phone numbers

---

## Next Phase: Phase 02 - Frontend Incoming Call UI

**Dependencies:** Phase 01 complete (backend foundation)

**Deliverables:**
1. Incoming call ring UI component
2. Caller ID display (from caller lookup)
3. Answer/Decline buttons (call state management)
4. Device event listeners for incoming calls
5. Call acceptance flow (connect → update message)
6. Missed call tracking

---

## Next Phase: Phase 03 - Call Routing & Distribution

**Dependencies:** Phase 01-02 complete

**Deliverables:**
1. Call queue management
2. Intelligent routing (round-robin, skill-based)
3. Call distribution to available staff
4. Fallback to voicemail/callback
5. Call analytics (answer rate, average handle time)

---

## Configuration

### Environment Variables Required

Already configured in `.env` for voice (all 7 vars):
```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_TWIML_APP_SID
TWILIO_WEBHOOK_BASE_URL
```

Check: `config.twilio.voiceConfigured` returns true

---

## Deployment Notes

### Database Migration
```bash
pnpm -F @ella/db migrate dev --name add_staff_presence
```

Generates migration in `packages/db/prisma/migrations/`.

### Server Restart
- Rate limiter state lost on restart (acceptable—in-memory only)
- StaffPresence records persist in database
- Staff must re-register after server restart

### Monitoring
- Watch logs for `[Voice Presence]` entries
- Monitor `lastSeen` timestamps for offline detection
- Check rate limiter logs for abuse patterns

---

## Architecture Diagram

```
┌─────────────────────────────────────┐
│   Incoming Call from Twilio         │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  Find online staff (Phase 02)        │
│  Query: StaffPresence where          │
│  isOnline=true AND lastSeen > 2min   │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  Ring available staff devices       │
│  POST /incoming to deviceId          │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  Staff answers call                 │
│  CONNECT message, update callSid    │
└────────────────┬────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────┐
│  Record call (webhook updates)      │
│  recordingUrl, recordingDuration    │
└─────────────────────────────────────┘
```

---

**Last Updated:** 2026-01-21
**Architecture Version:** 8.4.0
**Files Modified:** 4 (1 new, 3 enhanced)
