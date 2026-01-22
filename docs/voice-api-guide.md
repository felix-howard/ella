# Voice API & Recording Playback Guide

**Last Updated:** 2026-01-22
**Status:** Phase 02 Complete (Incoming Call Routing)
**Architecture Version:** 8.4.0

## Overview

Complete voice calling system: browser-based outbound calls (Phase 01-02) + incoming call routing to staff browsers (Phase 02) + recording playback (Phase 03). Backend manages Twilio integration, frontend handles user interaction. All UI Vietnamese-first with secure proxy for recording access. Incoming calls ring multiple staff browsers or route to voicemail if no staff online.

## Backend Architecture

### Voice Services (`apps/api/src/services/voice/`)

**Token Generator** (`token-generator.ts`)
- Generates JWT with VoiceGrant for staff identities
- TTL: 1 hour (3600 seconds)
- Supports outbound calls + inbound call acceptance (browser to browser via Twilio Client SDK)
- Used for browser Device registration to accept incoming calls
- Input: `identity: "staff_{staffId}"`
- Output: `{ token, expiresIn, identity }`

**TwiML Generator** (`twiml-generator.ts`)
- XML response for Twilio call routing
- **Outbound:** Includes recording config: `<Record>` with CallSid callback
- **Incoming:** Rings multiple staff browser clients via `<Client>` nouns (max 10, parallel)
- **Voicemail:** Vietnamese prompts with `<Say>` (Google Wavenet-A voice) + `<Record>` (120s max)
- Status callback for call completion webhook

### Voice Routes (`apps/api/src/routes/voice/index.ts`)

**POST /voice/token** - Generate access token
```
Request: empty (staffId from JWT)
Response: { token, expiresIn: 3600, identity: "staff_..." }
Errors: 503 (not configured), 401 (no staffId)
```

**GET /voice/status** - Check feature availability
```
Response: { available: bool, features: { outbound: bool, recording: bool, inbound: bool } }
Notes: Cacheable 5 minutes
```

**POST /voice/calls** - Create call message record
```
Request: { caseId, toPhone: "+1..." } (E.164 format)
Response: { messageId, conversationId, toPhone, clientName }
Errors: 503 (not configured), 401 (no auth), 404 (case not found)
Creates Message with channel='CALL', direction='OUTBOUND', callStatus='initiated'
```

**PATCH /voice/calls/:messageId** - Update message with Twilio CallSid
```
Request: { callSid: "CA..." }
Response: { success, messageId, callSid }
Errors: 404 (message not found)
Used by frontend after device.connect() returns
```

**GET /voice/recordings/:recordingSid** - Recording metadata (Phase 03)
```
Request: recordingSid (RE + 32 hex chars)
Response: { recordingSid, audioUrl: "/voice/recordings/.../audio" }
Errors: 400 (invalid format), 404 (not found or unauthorized)
Verifies user access via DB lookup
```

**GET /voice/recordings/:recordingSid/audio** - Streaming proxy (Phase 03)
```
Request: recordingSid (validated format)
Response: audio/mpeg stream (MP3 from Twilio)
Headers: Content-Type: audio/mpeg, Cache-Control: private, max-age=3600
Errors: 400 (invalid), 404 (not found), 500 (proxy failed)
Authentication: Twilio credentials used server-side (never exposed to client)
```

### Voice Webhooks (`apps/api/src/routes/webhooks/twilio.ts`)

**POST /webhooks/twilio/voice** - Call routing
- Triggered: When call connects
- Response: TwiML with `<Dial>` + `<Record>` tags
- Records: callSid from Twilio context
- Status callback: Points to voice/status webhook

**POST /webhooks/twilio/voice/recording** - Recording completion
- Triggered: When recording finishes
- Updates Message: recordingUrl, recordingDuration
- Stores: S3-compatible MP3 URL from Twilio CDN
- Duration: In seconds (optional)

**POST /webhooks/twilio/voice/status** - Call status updates
- Triggered: Call completion
- Updates: callStatus (completed, busy, no-answer, failed, canceled)
- Webhook signature validation (HMAC)

**POST /webhooks/twilio/voice/incoming** (Phase 02 NEW)
- Triggered: Incoming call from customer
- Input: From (caller phone), To (Twilio number), CallSid
- Flow:
  1. Lookup customer by phone number
  2. Get online staff via StaffPresence.isOnline=true
  3. If no staff online: Return voicemail TwiML
  4. If staff online: Create INBOUND call message with status='ringing', return TwiML to ring staff browsers
- Returns: TwiML with `<Dial>` containing `<Client>` nouns for staff device IDs (max 10 parallel)
- Staff device format: "staff_{staffId}" (from StaffPresence.deviceId)
- Ring timeout: 30 seconds (RING_TIMEOUT_SECONDS constant)

**POST /webhooks/twilio/voice/dial-complete** (Phase 02 NEW)
- Triggered: After ring timeout or call answer/end
- Input: DialCallStatus (completed|answered|no-answer|busy|failed), CallSid
- Flow:
  1. If status='completed|answered': Call was answered, return empty TwiML
  2. Otherwise: Route to voicemail, return voicemail TwiML
- Updates: Message callStatus to call status or voicemail message content
- Signature validation (HMAC)

**POST /webhooks/twilio/voice/voicemail-recording** (Phase 02 NEW)
- Triggered: Voicemail recording completion (after customer speaks)
- Input: RecordingSid, RecordingUrl, CallSid, RecordingDuration
- Flow:
  1. Find Message by CallSid
  2. Store RecordingUrl + RecordingDuration + update callStatus='voicemail'
- Updates: Message.recordingUrl, recordingDuration, callStatus
- Returns: JSON acknowledgment { received: true, processed: true }
- Signature validation (HMAC)

### Configuration (`.env`)

**Required Environment Variables:**
```
# SMS (Phase 01)
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER

# Voice API (Phase 01-03)
TWILIO_API_KEY_SID
TWILIO_API_KEY_SECRET
TWILIO_TWIML_APP_SID
TWILIO_WEBHOOK_BASE_URL

# Flag
VOICE_CONFIGURED=true (if all 7 vars present)
```

**Voice Configuration Check:**
```typescript
isVoiceConfigured() // All env vars present
```

## Incoming Call TwiML Generators (Phase 02)

### generateIncomingTwiml() - Ring Staff Browsers

**Purpose:** Generate TwiML to ring multiple staff browser clients simultaneously (parallel dial)

**Signature:**
```typescript
function generateIncomingTwiml(options: TwimlIncomingOptions): string
  interface TwimlIncomingOptions {
    staffIdentities: string[]  // e.g., ["staff_123", "staff_456"]
    callerId: string           // Caller phone (From)
    timeout: number            // Seconds to ring (default 30)
    dialCompleteUrl: string    // Webhook URL after dial timeout/answer
  }
```

**Returns:** TwiML XML response
```xml
<Response>
  <Dial timeout="30" action="..." method="POST" answerOnBridge="true">
    <Client>staff_123</Client>
    <Client>staff_456</Client>
  </Dial>
</Response>
```

**Key Features:**
- Max 10 staff browsers per call (limited by staffIdentities.slice(0, 10))
- answerOnBridge="true" means conversation starts when first staff accepts
- timeout triggers dial-complete webhook if no answer
- Parallel dial: All staff browsers ring simultaneously

### generateNoStaffTwiml() - Voicemail (No Staff Online)

**Purpose:** Play message + record voicemail when no staff available

**Signature:**
```typescript
function generateNoStaffTwiml(options: TwimlVoicemailOptions): string
  interface TwimlVoicemailOptions {
    voicemailCallbackUrl: string
    maxLength?: number        // Max seconds (default 120)
  }
```

**Vietnamese Messages:**
- Say: "Xin chào, hiện không có nhân viên trực. Xin vui lòng để lại tin nhắn sau tiếng bíp."
- After recording: "Không nhận được tin nhắn. Tạm biệt."
- Voice: Google Translate text-to-speech (vi-VN-Wavenet-A)

### generateVoicemailTwiml() - Voicemail (Dial Timeout)

**Purpose:** Play message + record voicemail after ring timeout

**Signature:**
```typescript
function generateVoicemailTwiml(options: TwimlVoicemailOptions): string
```

**Vietnamese Messages:**
- Say: "Nhân viên của chúng tôi hiện không thể nhận cuộc gọi. Xin vui lòng để lại tin nhắn sau tiếng bíp."
- After recording: "Không nhận được tin nhắn. Tạm biệt."
- Same voice engine as generateNoStaffTwiml()

**Differences:**
- generateNoStaffTwiml: Used when no staff online at call arrival
- generateVoicemailTwiml: Used after 30-second ring timeout with staff online but no answer

## Frontend Architecture

### Voice Client Hook (`apps/workspace/src/hooks/use-voice-call.ts`)

**State:**
- `isAvailable`: Voice feature enabled on backend
- `isLoading`: SDK loading or token fetching
- `callState`: idle | connecting | ringing | connected | disconnecting | error
- `isMuted`: Current mute status
- `duration`: Seconds elapsed (updates 1/sec during connected)
- `error`: User-friendly error message (Vietnamese)

**Actions:**
```typescript
initiateCall(toPhone, caseId): Promise<void>
endCall(): Promise<void>
toggleMute(): void
```

**Lifecycle:**
1. Mount: Load SDK → fetch token → create Device
2. Token Expiry: Auto-refresh 5 min before expiry
3. Call: Check permissions → create message → connect
4. Cleanup: Remove listeners, destroy device, clear timers

**Error Messages (Vietnamese):**
- Microphone denied: "Bạn cần cấp quyền microphone để gọi điện"
- Device not found: "Không tìm thấy microphone"
- Network errors: "Lỗi kết nối mạng"
- Token refresh failed: "Không thể làm mới phiên gọi. Vui lòng tải lại trang"

### AudioPlayer Component (Phase 03) (`apps/workspace/src/components/messaging/audio-player.tsx`)

**Props:**
```typescript
recordingSid: string      // Twilio RecordingSid (RE + 32 hex)
duration?: number         // Known duration in seconds (optional)
className?: string        // Custom CSS classes
```

**Features:**
- Lazy loading: Audio fetches on first play (not on render)
- Play/pause toggle with visual state change
- Seek bar: Click to reposition playback
- Time display: Current/Total (M:SS format, leading zero on seconds)
- Progress bar: Visual feedback during playback
- Error handling: Alert icon + Vietnamese message
- Accessibility: role="slider", aria-label, aria-valuemin/max/now

**State Flow:**
```
idle → loading (click play) → playing → paused → completed/error
       (audio element active)
```

**Styling:**
- Compact pill: flex, gap-3, rounded-lg, muted background
- Play button: 10x10 with icon, primary color
- Progress bar: 2px height, primary foreground
- Time labels: xs text, muted-foreground color
- Volume icon: hidden on mobile (sm:block)

**Events:**
- play: Updates isPlaying state
- pause: Updates isPlaying state
- timeupdate: Updates currentTime for progress bar
- durationchange: Updates duration for time display
- ended: Resets currentTime to 0
- error: Shows error message, disables playback
- loadstart/canplay: Manage loading state

**Error Cases:**
- Invalid RecordingSid format: 400 from backend
- Recording not found: 404 from backend
- Authorization failed: 404 (user doesn't have access)
- Network error: "Không thể tải bản ghi"
- Playback error: "Lỗi phát audio"

### Message Bubble Enhancement (`apps/workspace/src/components/messaging/message-bubble.tsx`)

**CALL Channel Support:**
```typescript
CALL: { icon: PhoneCall, label: 'Cuộc gọi', color: 'text-green-600' }
```

**Call Status Badges:**
- **completed** (green): PhoneCall icon, "Hoàn thành"
- **busy** (yellow): PhoneOff icon, "Bận"
- **no-answer** (orange): PhoneMissed icon, "Không bắt máy"
- **failed/canceled** (red): PhoneOff icon, "Thất bại"
- **initiated/ringing** (blue): PhoneCall icon, "Đang gọi..."
- **in-progress** (green): PhoneCall icon, "Đang kết nối"

**Rendering Logic:**
- CALL channel messages show status badge + content
- If recordingUrl present: Render embedded AudioPlayer
- Call duration display: Converts recordingDuration seconds to M:SS format
- Time formatting: Vietnamese locale (HH:MM format)

### API Client (`apps/workspace/src/lib/api-client.ts`)

**Voice Namespace Methods:**
```typescript
api.voice.getToken()                           // POST /voice/token
api.voice.getStatus()                          // GET /voice/status
api.voice.createCall(data)                     // POST /voice/calls
api.voice.getRecordingAudioUrl(recordingSid)   // Returns full URL string
```

**Recording URL Pattern:**
```
${API_BASE_URL}/voice/recordings/:recordingSid/audio
```

## Database Schema

### Message Model Extensions

**Call-Related Fields:**
- `channel: 'CALL'` - Message channel type
- `direction: 'OUTBOUND'` - Call direction
- `callSid: String?` - Twilio CallSid (set by webhook)
- `recordingUrl: String?` - Twilio CDN URL (set by recording webhook)
- `recordingDuration: Int?` - Duration in seconds (set by recording webhook)
- `callStatus: String?` - Terminal state (set by status webhook)

**Call Status Values (Outbound & Inbound):**
- `initiated` - Message created, calling starting
- `ringing` - Call ringing (outbound: on recipient, inbound: on staff browsers)
- `in-progress` - Call connected and recording
- `completed` - Call ended normally (answered by staff)
- `busy` - Recipient busy
- `no-answer` - Recipient didn't answer (staff didn't pick up within 30s)
- `voicemail` - Call routed to voicemail with recording (Phase 02 NEW)
- `failed` - Call failed (technical error)
- `canceled` - Call canceled by user

**Direction Values:**
- `OUTBOUND` - Staff initiated call to customer
- `INBOUND` - Customer initiated call to staff (Phase 02 NEW)

### Conversation Model

- `caseId: String!` - Tax case identifier (unique)
- `lastMessageAt: DateTime` - Timestamp of last message

### StaffPresence Model (Phase 01)

**Used for Incoming Call Routing (Phase 02):**
- `staffId: String!` - Foreign key to Staff
- `isOnline: Boolean` - Current online status (updated by heartbeat)
- `deviceId: String?` - Browser device identifier (e.g., "staff_123" for Twilio Client)
- `lastHeartbeatAt: DateTime` - Last activity timestamp

**Incoming Call Flow:**
1. Customer calls Twilio number → `/webhooks/twilio/voice/incoming` triggered
2. Webhook queries: `StaffPresence.findMany({ where: { isOnline: true } })`
3. Builds staff device IDs: `["staff_123", "staff_456"]`
4. Passes to `generateIncomingTwiml()` to ring all online staff browsers
5. First staff to answer connects; others' rings stop (answerOnBridge="true")

## Security

### Authorization

**Token-Based:**
- Staff JWT required for all endpoints
- Microphone permission checked before call initiation
- Token refreshes 5 min before expiry

**Recording Access:**
- Database lookup verifies staff created the call
- RecordingSid format validation (RE + 32 hex)
- Only staff who made call can listen to recording

### Credential Protection

**Backend Proxy:**
- Twilio credentials used server-side only
- Frontend gets signed URL to proxy endpoint
- MP3 streaming via authenticated proxy

**Error Sanitization:**
- No API keys in error messages
- No Twilio URLs in error messages
- Technical errors logged server-side only

### Input Validation

**E.164 Phone Format:**
- Pattern: `^\+[1-9]\d{9,14}$`
- US example: +14155551234

**RecordingSid Format:**
- Pattern: `^RE[0-9a-fA-F]{32}$`
- Example: REabcdef0123456789abcdef0123456789

## Performance

### Optimization Strategies

**Lazy Loading:**
- SDK: Loaded only when voice feature used
- Audio: Fetched only on first play click
- Saves bandwidth for non-voice conversations

**Streaming:**
- MP3 streamed from Twilio via proxy
- No full buffering in memory
- Content-Length forwarding enables progress bars

**Caching:**
- Voice token: Cached until 5 min before expiry
- HTTP cache: 3600s for repeated audio plays
- SDK: Cached on page to prevent reloads

**Cleanup:**
- Audio element: Destroyed on component unmount
- Event listeners: Removed to prevent memory leaks
- Timers: Cleared on unmount

### Benchmarks

- SDK load: ~2-3 seconds (first load only)
- Token fetch: ~200-500ms
- Call initiation: ~500-1000ms (microphone + network)
- Audio load + play: ~1-2 seconds
- Recording fetch: Varies by file size (streaming)

## Testing

### Unit Tests

**Voice Token Generation:**
- Token format validation
- Identity encoding
- Expiry time accuracy
- Error handling (missing env vars)

**Recording Endpoints:**
- RecordingSid validation (format checks)
- Authorization (database lookup)
- Error responses (404, 400, 500)
- Header forwarding (Content-Length)

**AudioPlayer Component:**
- Lazy load on first play
- Play/pause toggle state changes
- Seek bar click positioning
- Time display formatting (M:SS)
- Error state rendering
- Cleanup on unmount

**Message Bubble:**
- CALL channel rendering
- Status badge color selection
- AudioPlayer embedding
- Duration conversion

### Integration Tests

- E2E: Call initiation → Twilio webhook → recording stored → playback via UI
- Permissions: Unauthorized users cannot access recordings
- Format validation: Invalid RecordingSid rejected
- Error recovery: Network failures handled gracefully

## Troubleshooting

### Recording Not Playing

**Symptoms:** Button click doesn't load audio, spinner hangs

**Causes:**
- RecordingSid not in database (webhook didn't fire)
- Twilio credentials expired or invalid
- Network connectivity issues
- CORS blocked (check browser console)

**Solutions:**
- Verify webhook logs: POST /webhooks/twilio/voice/recording
- Check Twilio dashboard for recordings
- Inspect browser Network tab for 404/500 errors
- Verify TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN in env

### Authorization Denied

**Symptoms:** 404 error "Không thể tải bản ghi" when playing recording

**Causes:**
- Recording associated with different staff user
- Staff user doesn't have database access to message
- RecordingSid malformed or doesn't exist

**Solutions:**
- Verify message.recordingUrl contains valid RecordingSid
- Check message ownership (created by logged-in staff)
- Inspect DB for message record with recordingUrl

### Audio Playback Errors

**Symptoms:** "Lỗi phát audio" message appears

**Causes:**
- Browser doesn't support audio/mpeg
- Audio stream interrupted mid-playback
- Audio element error (browser native)

**Solutions:**
- Try different browser
- Check network stability
- Verify Twilio CDN is responding (curl test)

## Phase 02 Implementation Details

### Files Changed

**New Files:**
- `apps/api/src/services/voice/twiml-generator.ts` - TwiML generation (incoming, voicemail)

**Modified Files:**
- `apps/api/src/services/voice/index.ts` - Exported new TwiML generators
- `apps/api/src/routes/webhooks/twilio.ts` - Added 3 incoming call webhooks:
  - POST /webhooks/twilio/voice/incoming (148 LOC)
  - POST /webhooks/twilio/voice/dial-complete (67 LOC)
  - POST /webhooks/twilio/voice/voicemail-recording (55 LOC)
- `apps/api/src/routes/voice/index.ts` - Fixed linting (removed unused var, const vs let)

### Key Implementation Notes

**Rate Limiting:**
- All incoming webhooks rate-limited: 60 requests/minute per IP
- In-memory rate limiter with automatic cleanup

**Signature Validation:**
- All webhooks validate Twilio signature (HMAC-SHA1)
- Reconstructs URL from forwarded headers (handles ngrok/proxy)
- Returns 403 Forbidden on validation failure

**Database Transactions:**
- Incoming call message creation uses atomic transaction
- Updates conversation lastMessageAt timestamp
- Recording webhook uses transaction for find + update

**Call Routing Logic:**
1. Incoming call → lookup customer by phone (From)
2. Get online staff (StaffPresence.isOnline=true)
3. If online: Ring all staff browsers (parallel dial, max 10)
4. If offline: Go directly to voicemail
5. After 30s timeout: Update call status + route to voicemail
6. Recording webhook: Store voicemail URL + duration

**Vietnamese Voicemail Messages:**
- Google Wavenet-A voice (high quality, natural)
- Beep notification before recording
- Timeout confirmation message
- All messages in vi-VN locale

## Next Steps

**Phase 03:** (Completed) Recording playback endpoints + AudioPlayer component

**Phase 04:** Recording download feature with staff audit, recording duration confirmation

**Phase 05:** Recording transcription preview, call analytics dashboard

**Phase 06:** Quality metrics, retry logic, call recording archive

---

**Phase 02 Files:** 1 new service | 2 routes modified | ~270 LOC added
**Total Voice System:** ~1,200 LOC across services, routes, webhooks
**Dependencies:** Twilio SDK, @ella/ui, lucide-react, React hooks, Prisma
