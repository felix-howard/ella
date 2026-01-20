# Phase 02: Twilio Voice Calls Frontend Implementation

**Status:** Completed 2026-01-20
**Branch:** feature/more-enhancement

## Overview

Phase 02 Voice Calls delivers browser-based outbound voice calling in the workspace, enabling staff to make phone calls directly from conversations without external apps. Built on Twilio Client SDK with active call modal, mute/end controls, duration timer, and comprehensive error handling.

## Features

### 1. Twilio SDK Loader (`twilio-sdk-loader.ts`)

**Purpose:** Lazy-load Twilio SDK from CDN with type safety.

**Implementation:**
- Loads from: `https://sdk.twilio.com/js/client/releases/2.3.0/twilio.js`
- Caches SDK to prevent duplicate network requests
- Provides TypeScript types: `TwilioDeviceInstance`, `TwilioCall`, `TwilioCallEvent`
- Type-safe Device class: `new window.Twilio!.Device(token, options)`

**Types Exported:**
```typescript
type TwilioCallEvent = 'ringing' | 'accept' | 'disconnect' | 'cancel' | 'error'
interface TwilioCall { on(event, handler); off(event, handler); connect(); disconnect(); isMuted(); mute(boolean) }
interface TwilioDeviceInstance { on(event, handler); connect(params); destroy(); updateToken(token) }
```

### 2. Voice Call Hook (`use-voice-call.ts`)

**Purpose:** Manage Twilio Device, call state, and lifecycle.

**State:**
- `isAvailable`: Voice feature enabled on backend
- `isLoading`: SDK loading or token fetching
- `callState`: idle | connecting | ringing | connected | disconnecting | error
- `isMuted`: Mute status during active call
- `duration`: Seconds elapsed since connection (increments 1/sec)
- `error`: User-friendly error message (Vietnamese)

**Actions:**
- `initiateCall(toPhone, caseId)`: Start outbound call
- `endCall()`: Disconnect active call
- `toggleMute()`: Toggle mute status

**Lifecycle:**
1. **Mount:** Load SDK from CDN → fetch voice token → create Twilio Device → listen for ready/error
2. **Token Expiry:** Listen for `tokenWillExpire` event → auto-refresh token with 5-min buffer
3. **Call Initiation:**
   - Check microphone permission via `getUserMedia({ audio: true })`
   - Validate token not expired (5-min buffer)
   - Create message record via `POST /voice/calls`
   - Connect Twilio call with `device.connect()`
4. **Call Events:** Register listeners for ringing, accept, disconnect, cancel, error
5. **Cleanup:** Remove all listeners, stop timer, destroy device on unmount

**Error Handling:**
All technical errors sanitized to Vietnamese messages:
- `NotAllowedError` → "Bạn cần cấp quyền microphone để gọi điện"
- `NotFoundError` → "Không tìm thấy microphone"
- Network errors → "Lỗi kết nối mạng"
- Token refresh failure → "Không thể làm mới phiên gọi. Vui lòng tải lại trang"

**Duration Timer:**
- Starts on 'accept' event
- Increments every 1 second via `setInterval`
- Displays as HH:MM:SS in modal
- Stops and resets on disconnect/error

### 3. Call Button Component (`call-button.tsx`)

**Purpose:** Phone icon button to initiate calls.

**States:**
- **Loading:** Shows spinner, disabled
- **Unavailable:** Hidden (after load completes)
- **Idle:** Phone icon, enabled
- **Active Call:** Green pulsing icon, disabled
- **Error:** Icon visible, disabled

**Accessibility:**
- `aria-label`: Dynamic labels ("Đang tải", "Đang gọi", "Gọi điện")
- `title`: Tooltip with full description
- `aria-hidden="true"`: Icons don't get announced
- Disabled state via `disabled` attribute

**Styling:**
- Icon: 4x4 (w-4 h-4)
- Padding: p-2
- Rounded: rounded-lg
- Hover: text-foreground, bg-muted (when enabled)
- Active: text-green-500, animate-pulse
- Vietnamese: "Gọi điện cho khách hàng" (tooltip)

### 4. Active Call Modal (`active-call-modal.tsx`)

**Purpose:** Display during connected calls with controls.

**Display:**
- Fixed overlay with backdrop (black/50)
- Max-width 28rem (448px)
- Centered on screen
- Rounded-xl corners with shadow

**Content:**
- **Header:** Client name + "Cuộc gọi"
- **Body:** Phone number, duration timer (HH:MM:SS), last activity
- **Controls:**
  - Mute button (toggles muted status) with indicator ("Tắt tiếng" / "Bật tiếng")
  - End call button ("Kết thúc cuộc gọi")
- **Footer:** Escape key closes (but doesn't disconnect)

**Accessibility:**
- `role="dialog"`, `aria-modal="true"`
- Focus trap (prevents tabbing outside modal)
- Escape key handler
- Close button always available
- Error messages with `role="alert"`

**Interaction:**
- Backdrop click: Allowed (closes modal, keeps call active)
- Escape key: Closes modal, keeps call active
- Mute button: Toggles mute without disconnecting
- End call button: Disconnects and closes modal

### 5. Message Bubble Enhancement (`message-bubble.tsx`)

**Purpose:** Display voice calls in message history.

**CALL Channel Support:**
```typescript
CALL: {
  icon: PhoneCall,
  label: 'Cuộc gọi',
  color: 'text-green-600'
}
```

**Display:**
- Phone icon in conversation
- Green text color
- Label: "Cuộc gọi"
- Optional: Call duration if available in message content

### 6. Messaging Route Integration (`messages/$caseId.tsx`)

**Purpose:** Wire voice calling into conversation UI.

**Integration:**
- Load `useVoiceCall()` hook on route mount
- Add `CallButton` to conversation header
- Render `ActiveCallModal` when `callState !== 'idle'`
- Pass call state/actions to components

**Flow:**
1. User sees conversation with phone icon button (if voice available)
2. Click button → check mic permission → open modal or dial directly
3. Modal shows phone input if not provided
4. Click "Gọi điện" → initiate call via `initiateCall(phone, caseId)`
5. Twilio connects → modal shows connected state + duration timer
6. User can mute or end call
7. Call disconnects → modal closes, message added to history

## API Integration

### Endpoints

**`POST /voice/token`**
- Returns: `{ token, expiresIn, identity }`
- Used by: Hook on mount and token refresh
- Expires: 1 hour (3600 seconds)
- Error: 503 if voice not configured, 401 if no staffId

**`POST /voice/calls`**
- Body: `{ caseId, toPhone }`
- Returns: `{ messageId, conversationId, toPhone, clientName }`
- Used by: Hook before initiating call
- Creates message record with status='initiated'

**`GET /voice/status`**
- Returns: `{ available, features: { outbound, recording, inbound } }`
- Used by: Hook to check if voice enabled
- Cache-friendly (can cache 5 minutes)

### API Client Methods (Additions)

```typescript
api.voice.getToken(): Promise<{ token, expiresIn, identity }>
api.voice.getStatus(): Promise<{ available, features }>
api.voice.createCall(data): Promise<{ messageId, conversationId, toPhone, clientName }>
```

## Security Considerations

1. **Microphone Permission:** Check via `getUserMedia` before each call
2. **Token Validation:** 5-min buffer prevents expired tokens mid-call
3. **Message Record:** Call tracked in database with call message channel
4. **Error Sanitization:** No API keys, paths, or technical details in error messages
5. **Focus Trap:** Prevents accidental interaction during calls

## Performance Optimizations

1. **SDK Lazy-Load:** Loaded only when needed (not on page init)
2. **Token Caching:** Reused for multiple calls (until expiry)
3. **Listener Cleanup:** Removed from call to prevent memory leaks
4. **Unmount Cleanup:** Device destroyed, timers cleared, listeners removed
5. **Mounted Check:** Prevents state updates on unmounted component

## Vietnamese Localization

**All UI text in Vietnamese:**
- Button labels: "Gọi điện", "Đang tải", "Đang gọi"
- Modal labels: "Cuộc gọi", "Tắt tiếng", "Bật tiếng", "Kết thúc cuộc gọi"
- Error messages: Microphone, network, token refresh (all sanitized)
- Tooltips: "Gọi điện cho khách hàng", "Không đủ quyền truy cập"

## Files Changed

### New Files (3)
- `apps/workspace/src/lib/twilio-sdk-loader.ts` - SDK loader + types
- `apps/workspace/src/hooks/use-voice-call.ts` - Voice call hook (330 LOC)
- `apps/workspace/src/components/messaging/active-call-modal.tsx` - Call modal

### Modified Files (6)
- `apps/workspace/src/lib/api-client.ts` - Added voice API methods
- `apps/workspace/src/hooks/index.ts` - Export useVoiceCall
- `apps/workspace/src/components/messaging/call-button.tsx` - New button component
- `apps/workspace/src/components/messaging/message-bubble.tsx` - CALL channel support
- `apps/workspace/src/components/messaging/index.ts` - Export components
- `apps/workspace/src/routes/messages/$caseId.tsx` - Integrate voice calling

## Testing Checklist

- [ ] Voice SDK loads successfully (check Network tab)
- [ ] Token fetched on mount (check API calls)
- [ ] Microphone permission check works
- [ ] Call button visible only when voice available
- [ ] Phone input prompt appears on click
- [ ] Call connects via Twilio SDK
- [ ] Duration timer increments in 1-second intervals
- [ ] Mute button toggles mute status visually
- [ ] End call button disconnects call
- [ ] Escape key closes modal without disconnecting
- [ ] Call message appears in history with CALL channel
- [ ] Error messages display in Vietnamese
- [ ] No console errors or memory leaks

## Next Steps

1. **Phase 03:** Add call recording playback in message history
2. **Phase 04:** Add call statistics (duration, quality, retry logic)
3. **Phase 05:** Implement voicemail detection
4. **Phase 06:** Add call analytics and quality metrics

---

**Last Updated:** 2026-01-20
**Architecture Version:** 8.2.0
**Files Modified:** 9 files (3 new, 6 enhanced)
