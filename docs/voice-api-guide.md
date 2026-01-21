# Voice API & Recording Playback Guide

**Last Updated:** 2026-01-20
**Status:** Phase 03 Complete (Recording Playback)
**Architecture Version:** 8.3.0

## Overview

Complete voice calling system: browser-based outbound calls (Phase 01-02) + recording playback (Phase 03). Backend manages Twilio integration, frontend handles user interaction. All UI Vietnamese-first with secure proxy for recording access.

## Backend Architecture

### Voice Services (`apps/api/src/services/voice/`)

**Token Generator** (`token-generator.ts`)
- Generates JWT with VoiceGrant for staff identities
- TTL: 1 hour (3600 seconds)
- Outbound calling only (inbound not implemented)
- Input: `identity: "staff_{staffId}"`
- Output: `{ token, expiresIn, identity }`

**TwiML Generator** (`twiml-generator.ts`)
- XML response for Twilio call routing
- Includes recording config: `<Record>` with CallSid callback
- Status callback for call completion webhook
- Dial context with phone number validation

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

**Call Status Values:**
- `initiated` - Message created, calling starting
- `ringing` - Call ringing on recipient end
- `in-progress` - Call connected and recording
- `completed` - Call ended normally
- `busy` - Recipient busy
- `no-answer` - Recipient didn't answer
- `failed` - Call failed (technical error)
- `canceled` - Call canceled by user

### Conversation Model

- `caseId: String!` - Tax case identifier (unique)
- `lastMessageAt: DateTime` - Timestamp of last message

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

## Next Steps

**Phase 04:** Recording duration confirmation via webhook, add download feature with staff audit

**Phase 05:** Recording transcription preview, add search by transcript

**Phase 06:** Call analytics dashboard, quality metrics, retry logic

---

**Files:** 5 backend + 1 frontend new | 3 backend + 2 frontend modified
**Lines:** ~700 LOC total
**Dependencies:** Twilio SDK, @ella/ui, lucide-react, React hooks
