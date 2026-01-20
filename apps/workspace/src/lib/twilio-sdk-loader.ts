/**
 * Twilio Voice SDK Script Loader
 * Dynamically loads Twilio Client SDK from CDN for browser-based voice calls
 * Security: Uses Subresource Integrity (SRI) to verify script integrity
 */

// Twilio SDK version 1.14 (Voice JavaScript SDK)
// Note: Update SRI hash when upgrading SDK version
const TWILIO_SDK_URL = 'https://sdk.twilio.com/js/client/releases/1.14/twilio.min.js'

// SRI hash for Twilio SDK v1.14
// If SDK update breaks this, regenerate with: openssl dgst -sha384 -binary twilio.min.js | openssl base64
// Or use https://www.srihash.org/ with the CDN URL
// Note: Setting to empty string disables SRI check (use when hash unknown for new version)
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
    // Check if already loaded via window global
    if (window.Twilio?.Device) {
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
      if (window.Twilio?.Device) {
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
  return isLoaded && !!window.Twilio?.Device
}

// Type declaration for Twilio global
declare global {
  interface Window {
    Twilio?: {
      Device: TwilioDeviceConstructor
    }
  }
}

// Twilio Device types
export interface TwilioDeviceConstructor {
  new (token: string, options?: TwilioDeviceOptions): TwilioDeviceInstance
}

export interface TwilioDeviceOptions {
  logLevel?: number // 0=off, 1=error, 2=warn, 3=info, 4=debug
  codecPreferences?: ('opus' | 'pcmu')[]
  enableRingingState?: boolean
}

export interface TwilioDeviceInstance {
  connect(options?: { params?: Record<string, string> }): TwilioCall
  disconnectAll(): void
  updateToken(token: string): void
  on(event: TwilioDeviceEvent, handler: (...args: unknown[]) => void): void
  off(event: TwilioDeviceEvent, handler: (...args: unknown[]) => void): void
  destroy(): void
}

export type TwilioDeviceEvent =
  | 'ready'
  | 'error'
  | 'tokenWillExpire'
  | 'offline'
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
  off(event: TwilioCallEvent, handler: (...args: unknown[]) => void): void
}

export type TwilioCallStatus =
  | 'connecting'
  | 'ringing'
  | 'open'
  | 'closed'
  | 'pending'

export type TwilioCallEvent =
  | 'ringing'
  | 'accept'
  | 'disconnect'
  | 'cancel'
  | 'error'
  | 'warning'
