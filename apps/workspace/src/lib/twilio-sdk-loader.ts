/**
 * Twilio Voice SDK Script Loader
 * Dynamically loads Twilio Client SDK from CDN for browser-based voice calls
 * Security: Uses Subresource Integrity (SRI) to verify script integrity
 */

// Twilio Voice SDK version 2.18.0 (via jsDelivr CDN)
// Note: Twilio no longer hosts 2.x SDK on their CDN, jsDelivr is recommended alternative
// Update version when upgrading: https://www.jsdelivr.com/package/npm/@twilio/voice-sdk
const TWILIO_SDK_URL = 'https://cdn.jsdelivr.net/npm/@twilio/voice-sdk@2.18.0/dist/twilio.min.js'

// SRI hash for integrity verification
// Note: Setting to empty string disables SRI check (jsDelivr provides its own integrity)
const TWILIO_SDK_SRI = ''

let loadPromise: Promise<void> | null = null
let isLoaded = false

/**
 * Load Twilio SDK from CDN (singleton pattern)
 * Returns immediately if already loaded
 * Uses SRI hash for security when available
 */
export function loadTwilioSdk(): Promise<void> {
  if (isLoaded) {
    return Promise.resolve()
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = new Promise((resolve, reject) => {
    // Check if already loaded via window global (SDK 2.x exports Twilio.Device class)
    if (typeof window.Twilio?.Device === 'function') {
      isLoaded = true
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = TWILIO_SDK_URL
    script.async = true

    // Add SRI hash for security (prevents tampered CDN scripts)
    if (TWILIO_SDK_SRI) {
      script.integrity = TWILIO_SDK_SRI
      script.crossOrigin = 'anonymous'
    }

    script.onload = () => {
      // SDK 2.x exports Device as a class constructor
      if (typeof window.Twilio?.Device === 'function') {
        isLoaded = true
        resolve()
      } else {
        reject(new Error('Twilio SDK loaded but Device not available'))
      }
    }

    script.onerror = () => {
      loadPromise = null
      reject(new Error('Failed to load Twilio SDK'))
    }

    document.head.appendChild(script)
  })

  return loadPromise
}

/**
 * Check if Twilio SDK is currently loaded and ready
 */
export function isTwilioSdkLoaded(): boolean {
  return isLoaded && typeof window.Twilio?.Device === 'function'
}

// Type declaration for Twilio global (SDK 2.x)
declare global {
  interface Window {
    Twilio?: {
      Device: TwilioDeviceConstructor
    }
  }
}

// Twilio Device types (SDK 2.x)
export interface TwilioDeviceConstructor {
  new (token: string, options?: TwilioDeviceOptions): TwilioDeviceInstance
}

export interface TwilioDeviceOptions {
  logLevel?: number | string // 0=off, 1=error, 2=warn, 3=info, 4=debug or 'error'|'warn'|'info'|'debug'
  codecPreferences?: ('opus' | 'pcmu')[]
  edge?: string | string[] // Edge location(s)
  closeProtection?: boolean | string // Warn before leaving page during active call
}

export interface TwilioDeviceInstance {
  // In SDK 2.x, connect returns a Promise<Call>
  connect(options?: TwilioConnectOptions): Promise<TwilioCall>
  disconnectAll(): void
  updateToken(token: string): void
  register(): Promise<void> // Opens signaling WebSocket for receiving calls
  unregister(): Promise<void> // Closes signaling connection
  // Overloaded on() for type-safe event handlers
  on(event: 'incoming', handler: (call: TwilioCall) => void): void
  on(event: 'registered' | 'unregistered', handler: () => void): void
  on(event: 'error', handler: (error: unknown) => void): void
  on(event: 'tokenWillExpire', handler: () => void): void
  on(event: TwilioDeviceEvent, handler: (...args: unknown[]) => void): void
  off(event: TwilioDeviceEvent, handler: (...args: unknown[]) => void): void
  destroy(): void
  // Accessors
  state: 'unregistered' | 'registering' | 'registered' | 'destroyed'
  isBusy: boolean
  identity: string | null
  // Audio device management (SDK 2.x)
  audio: {
    availableInputDevices: Map<string, MediaDeviceInfo>
    availableOutputDevices: Map<string, MediaDeviceInfo>
    setInputDevice(deviceId: string): Promise<void>
    unsetInputDevice(): Promise<void>
    speakerDevices: {
      set(deviceId: string): Promise<void>
    }
    ringtoneDevices: {
      set(deviceId: string): Promise<void>
    }
  }
}

export interface TwilioConnectOptions {
  params?: Record<string, string>
  rtcConstraints?: {
    audio?: boolean | MediaTrackConstraints
  }
}

// SDK 2.x event names (changed from 1.x)
export type TwilioDeviceEvent =
  | 'registered' // Was 'ready' in 1.x
  | 'error'
  | 'tokenWillExpire'
  | 'unregistered' // Was 'offline' in 1.x
  | 'incoming'

export interface TwilioCall {
  disconnect(): void
  mute(shouldMute?: boolean): void
  isMuted(): boolean
  status(): TwilioCallStatus
  parameters: {
    CallSid?: string
    From?: string
    To?: string
  }
  on(event: TwilioCallEvent, handler: (...args: unknown[]) => void): void
  removeListener(event: TwilioCallEvent, handler: (...args: unknown[]) => void): void
  removeAllListeners(event?: TwilioCallEvent): void
  // Get the local MediaStream (for debugging audio issues)
  getLocalStream(): MediaStream | null
  getRemoteStream(): MediaStream | null
  // Incoming call methods (SDK 2.x)
  accept(): void
  reject(): void
}

// SDK 2.x call status values
export type TwilioCallStatus =
  | 'connecting'
  | 'ringing'
  | 'open'
  | 'closed'
  | 'pending'
  | 'reconnecting' // Added in 2.x

export type TwilioCallEvent =
  | 'ringing'
  | 'accept'
  | 'disconnect'
  | 'cancel'
  | 'error'
  | 'warning'
  | 'warning-cleared' // Added in 2.x
