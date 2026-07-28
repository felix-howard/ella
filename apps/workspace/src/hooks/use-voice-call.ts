/**
 * useVoiceCall Hook
 * Manages Twilio Voice SDK device and call state for browser-based voice calls
 * Features: mic permission check, token refresh, error sanitization, proper cleanup,
 *           incoming call handling, presence tracking
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { api, ApiError } from '../lib/api-client'
import {
  loadTwilioSdk,
  type TwilioDeviceInstance,
  type TwilioCall,
} from '../lib/twilio-sdk-loader'
import { playRingSound, stopRingSound, cleanupRingSound } from '../lib/ring-sound'
import { toast } from '../stores/toast-store'

export type CallState =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'disconnecting'
  | 'error'

// Caller info for incoming calls
export interface CallerInfo {
  phone: string
  clientName: string | null
  caseId: string | null
  conversationId: string | null
}

export interface VoiceCallState {
  isAvailable: boolean
  isLoading: boolean
  callState: CallState
  isMuted: boolean
  duration: number
  error: string | null
  // Incoming call state
  incomingCall: TwilioCall | null
  callerInfo: CallerInfo | null
  // Device registration status (for UI indicator)
  isRegistered: boolean
  isRegistering: boolean
}

export interface VoiceCallActions {
  initiateCall: (toPhone: string, caseId: string) => Promise<void>
  endCall: () => void
  toggleMute: () => void
  // Incoming call actions
  acceptIncoming: () => void
  rejectIncoming: () => void
}

// Get user-friendly error message using i18n
function getErrorMessage(error: unknown, t: (key: string) => string): string {
  if (!error) return t('voiceError.default')

  const errObj = error as Record<string, unknown>
  const errorKey = String(errObj.name || errObj.code || '')

  // Map error names to translation keys
  const keyMap: Record<string, string> = {
    NotAllowedError: 'voiceError.micPermissionRequired',
    NotFoundError: 'voiceError.micNotFound',
    NotSupportedError: 'voiceError.browserNotSupported',
    OverconstrainedError: 'voiceError.micOverconstrained',
    SecurityError: 'voiceError.securityError',
    AbortError: 'voiceError.abortError',
    InvalidStateError: 'voiceError.invalidState',
    NETWORK_ERROR: 'voiceError.networkError',
    TIMEOUT: 'voiceError.timeout',
  }

  return t(keyMap[errorKey] || 'voiceError.default')
}

// Check microphone permission using Permission API (avoids opening/closing streams)
async function checkMicrophonePermission(): Promise<boolean> {
  try {
    // Try Permission API first (doesn't require opening a stream)
    if (navigator.permissions && navigator.permissions.query) {
      const result = await navigator.permissions.query({ name: 'microphone' as PermissionName })
      if (result.state === 'granted') return true
      if (result.state === 'denied') return false
      // 'prompt' state - need to actually request
    }

    // Fallback: Request with minimal constraints, stop immediately
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    stream.getTracks().forEach((track) => track.stop())
    return true
  } catch {
    return false
  }
}

// Select proper microphone input device (avoid "Stereo Mix" which captures system audio)
// Called only when user initiates/accepts a call, not on registration
async function selectMicrophoneInput(device: TwilioDeviceInstance): Promise<void> {
  try {
    const inputDevices = device.audio?.availableInputDevices
    if (!inputDevices || inputDevices.size === 0) return

    let selectedDevice: MediaDeviceInfo | null = null

    for (const [deviceId, deviceInfo] of inputDevices) {
      const label = deviceInfo.label.toLowerCase()
      if (import.meta.env.DEV) {
        console.log(`[Voice] Input device: ${deviceInfo.label} (${deviceId})`)
      }

      if (label.includes('stereo mix')) continue

      if (label.includes('microphone') || label.includes('default')) {
        selectedDevice = deviceInfo
        break
      }

      if (!selectedDevice) {
        selectedDevice = deviceInfo
      }
    }

    if (selectedDevice) {
      await device.audio.setInputDevice(selectedDevice.deviceId)
      if (import.meta.env.DEV) {
        console.log(`[Voice] Selected input device: ${selectedDevice.label}`)
      }
    }
  } catch (e) {
    if (import.meta.env.DEV) {
      console.warn('[Voice] Could not set input device:', e)
    }
  }
}

// Check if token is still valid (with 5 min buffer)
function isTokenValid(expiryTime: number): boolean {
  const bufferMs = 5 * 60 * 1000 // 5 minutes
  return Date.now() < expiryTime - bufferMs
}

const PRESENCE_HEARTBEAT_MS = 30000
const PRESENCE_UNREGISTER_DEDUPE_MS = 10000
const PRESENCE_REGISTER_RETRY_MS = 65000
const OUTBOUND_CONNECT_TIMEOUT_MS = 30000

export function useVoiceCall(): [VoiceCallState, VoiceCallActions] {
  const { t } = useTranslation()
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [callState, setCallState] = useState<CallState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Incoming call state
  const [incomingCall, setIncomingCall] = useState<TwilioCall | null>(null)
  const [callerInfo, setCallerInfo] = useState<CallerInfo | null>(null)
  // Device registration status (for UI indicator only)
  const [isRegistered, setIsRegistered] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)

  const deviceRef = useRef<TwilioDeviceInstance | null>(null)
  const callRef = useRef<TwilioCall | null>(null)
  const timerRef = useRef<number | null>(null)
  const tokenExpiryRef = useRef<number>(0)
  const outboundAttemptRef = useRef(0)
  const outboundAttemptActiveRef = useRef(false)
  const outboundConnectPendingRef = useRef(false)
  const deviceLifecycleRef = useRef(0)
  const deviceSetupPromiseRef = useRef<Promise<boolean> | null>(null)
  const knownCallsRef = useRef(new WeakSet<TwilioCall>())
  const messageIdRef = useRef<string | null>(null) // Track message ID for CallSid update
  const incomingCallRef = useRef<TwilioCall | null>(null) // Track incoming call for timeout
  const heartbeatIntervalRef = useRef<number | null>(null) // Presence heartbeat timer
  const mountedRef = useRef(true) // Track component mount status for cleanup
  const autoRegisterTriggeredRef = useRef(false) // Track if auto-register has been triggered this session
  const gestureCleanupRef = useRef<(() => void) | null>(null) // Cleanup gesture listeners
  const presenceOnlineRef = useRef(false)
  const unregisterPresenceInFlightRef = useRef(false)
  const lastPresenceUnregisterAtRef = useRef(0)
  const registerPresenceRetryRef = useRef<number | null>(null)

  // Cleanup call event listeners
  const cleanupCallListeners = useCallback(() => {
    if (callRef.current) {
      // SDK 2.x uses removeAllListeners instead of off
      try {
        callRef.current.removeAllListeners()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[Voice] Error removing listeners:', e)
        }
      }
    }
  }, [])

  // Start duration timer once per connected call.
  const startTimer = useCallback(() => {
    if (timerRef.current !== null) return

    setDuration(0)
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finalizeCall = useCallback(
    (
      call: TwilioCall | null,
      nextState: 'idle' | 'error',
      nextError?: string
    ) => {
      if (call && callRef.current !== call) return

      outboundAttemptRef.current += 1
      outboundAttemptActiveRef.current = false
      outboundConnectPendingRef.current = false
      stopTimer()
      setIsMuted(false)
      cleanupCallListeners()
      callRef.current = null
      messageIdRef.current = null
      if (nextError) {
        setError(nextError)
      }
      setCallState(nextState)
    },
    [cleanupCallListeners, stopTimer]
  )

  const disconnectDeviceSafely = useCallback(() => {
    try {
      deviceRef.current?.disconnectAll()
    } catch (e) {
      if (import.meta.env.DEV) {
        console.warn('[Voice] Device disconnect failed:', e)
      }
    }
  }, [])

  const disconnectCallSafely = useCallback(
    (call: TwilioCall, allowDeviceFallback: boolean) => {
      try {
        call.disconnect()
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[Voice] Call disconnect failed:', e)
        }
        if (allowDeviceFallback) {
          disconnectDeviceSafely()
        }
      }
    },
    [disconnectDeviceSafely]
  )

  const disconnectStaleCallSafely = useCallback(
    (call: TwilioCall) => {
      const hasReplacement = Boolean(
        callRef.current ||
        incomingCallRef.current ||
        outboundAttemptActiveRef.current
      )
      disconnectCallSafely(call, !hasReplacement)
    },
    [disconnectCallSafely]
  )

  // Track if voice feature is available on server
  const voiceAvailableRef = useRef(false)

  const markPresenceOffline = useCallback(async () => {
    if (!presenceOnlineRef.current || unregisterPresenceInFlightRef.current) return

    const now = Date.now()
    if (now - lastPresenceUnregisterAtRef.current < PRESENCE_UNREGISTER_DEDUPE_MS) return

    presenceOnlineRef.current = false
    unregisterPresenceInFlightRef.current = true
    lastPresenceUnregisterAtRef.current = now

    try {
      await api.voice.unregisterPresence()
    } catch (e) {
      if (import.meta.env.DEV && !(e instanceof ApiError && e.status === 401)) {
        console.warn('[Voice] Presence unregister failed:', e)
      }
    } finally {
      unregisterPresenceInFlightRef.current = false
    }
  }, [])

  const startPresenceHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = window.setInterval(async () => {
      try {
        await api.voice.heartbeat()
      } catch {
        // Heartbeat failed - device might be offline
      }
    }, PRESENCE_HEARTBEAT_MS)
  }, [])

  const schedulePresenceRegisterRetry = useCallback(() => {
    if (registerPresenceRetryRef.current) {
      clearTimeout(registerPresenceRetryRef.current)
    }

    registerPresenceRetryRef.current = window.setTimeout(async () => {
      registerPresenceRetryRef.current = null
      if (!mountedRef.current || presenceOnlineRef.current) return

      try {
        await api.voice.registerPresence()
        if (!mountedRef.current) return
        presenceOnlineRef.current = true
        setIsRegistered(true)
        setIsRegistering(false)
        startPresenceHeartbeat()
      } catch {
        // Leave the device registered with Twilio; a later visibility/register event can retry.
      }
    }, PRESENCE_REGISTER_RETRY_MS)
  }, [startPresenceHeartbeat])

  // Check voice availability and preload SDK (but DON'T create Device - AudioContext issue)
  useEffect(() => {
    let mounted = true
    mountedRef.current = true
    deviceLifecycleRef.current += 1

    async function init() {
      try {
        // Check if voice is available on server
        const status = await api.voice.getStatus()
        if (!mounted) return

        if (!status.available) {
          setIsAvailable(false)
          setIsLoading(false)
          return
        }

        voiceAvailableRef.current = true

        // Preload Twilio SDK from CDN (doesn't create AudioContext)
        await loadTwilioSdk()
        if (!mounted) return

        // Mark as available - Device will be created on first call (user gesture)
        // This avoids AudioContext being created before user interaction
        setIsAvailable(true)
        setIsLoading(false)
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[Voice] Init failed:', e)
        }
        if (mounted) {
          setError(getErrorMessage(e, t))
          setIsAvailable(false)
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
      mountedRef.current = false // Mark as unmounted for async handlers
      deviceLifecycleRef.current += 1
      outboundAttemptRef.current += 1
      outboundAttemptActiveRef.current = false
      outboundConnectPendingRef.current = false
      deviceSetupPromiseRef.current = null
      cleanupCallListeners()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
      }
      if (registerPresenceRetryRef.current) {
        clearTimeout(registerPresenceRetryRef.current)
      }
      if (deviceRef.current) {
        deviceRef.current.destroy()
        deviceRef.current = null
      }
      callRef.current = null
      incomingCallRef.current = null
      messageIdRef.current = null
      cleanupRingSound()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupCallListeners])

  // Create and setup Twilio Device (called on first user gesture)
  const setupDevice = useCallback((): Promise<boolean> => {
    if (deviceRef.current) return Promise.resolve(true) // Already setup
    if (!voiceAvailableRef.current) return Promise.resolve(false)
    if (deviceSetupPromiseRef.current) return deviceSetupPromiseRef.current

    const setupPromise = (async () => {
      const lifecycle = deviceLifecycleRef.current
      const isSetupCurrent = () => (
        mountedRef.current && deviceLifecycleRef.current === lifecycle
      )

      try {
      // Get voice token from server
      const tokenResponse = await api.voice.getToken()
      if (!isSetupCurrent()) return false

      // Create Twilio Device instance (SDK 2.x)
      // This creates AudioContext - MUST be after user gesture
      const device = new window.Twilio!.Device(tokenResponse.token, {
        logLevel: import.meta.env.DEV ? 1 : 0, // 0=silent, 1=error only
        codecPreferences: ['opus', 'pcmu'],
        edge: 'roaming',
      })

      // Setup event handlers
      device.on('error', (err: unknown, affectedCall?: TwilioCall) => {
        const nextError = getErrorMessage(err, t)
        if (affectedCall) {
          const isCurrentCall = callRef.current === affectedCall
          const isPendingCall = (
            !callRef.current &&
            outboundAttemptActiveRef.current &&
            !knownCallsRef.current.has(affectedCall)
          )
          finalizeCall(isPendingCall ? null : affectedCall, 'error', nextError)
          disconnectCallSafely(affectedCall, isCurrentCall || isPendingCall)
          return
        }

        const activeCall = callRef.current
        if (activeCall) {
          finalizeCall(activeCall, 'error', nextError)
          disconnectCallSafely(activeCall, true)
        } else {
          disconnectDeviceSafely()
          finalizeCall(null, 'error', nextError)
        }
      })

      device.on('tokenWillExpire', async () => {
        try {
          const newToken = await api.voice.getToken()
          device.updateToken(newToken.token)
          tokenExpiryRef.current = Date.now() + newToken.expiresIn * 1000
        } catch (e) {
          if (import.meta.env.DEV) {
            console.error('[Voice] Token refresh failed:', e)
          }
        }
      })

      deviceRef.current = device
      tokenExpiryRef.current = Date.now() + tokenResponse.expiresIn * 1000

      // Setup incoming call handler - always show modal for staff to accept/reject
      device.on('incoming', async (call: TwilioCall) => {
        knownCallsRef.current.add(call)
        const fromPhone = call.parameters.From || 'Unknown'

        // Don't accept if already in a call
        if (
          callRef.current ||
          incomingCallRef.current ||
          outboundAttemptActiveRef.current ||
          outboundConnectPendingRef.current
        ) {
          call.reject()
          return
        }

        // Store call reference
        incomingCallRef.current = call
        setIncomingCall(call)

        // Fetch caller info from backend
        try {
          const info = await api.voice.lookupCaller(fromPhone)
          setCallerInfo({
            phone: fromPhone,
            clientName: info.conversation?.clientName || null,
            caseId: info.conversation?.caseId || null,
            conversationId: info.conversation?.id || null,
          })
        } catch {
          // Unknown caller
          setCallerInfo({
            phone: fromPhone,
            clientName: null,
            caseId: null,
            conversationId: null,
          })
        }

        // Play ring sound
        playRingSound()

        // Listen for cancel (caller hung up before answer)
        call.on('cancel', () => {
          stopRingSound()
          setIncomingCall(null)
          setCallerInfo(null)
          incomingCallRef.current = null
        })

        call.on('disconnect', () => {
          stopRingSound()
          setCallState('idle')
          setIncomingCall(null)
          setCallerInfo(null)
          callRef.current = null
          incomingCallRef.current = null
          // Stop timer
          if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
          }
        })
      })

      // Setup presence registration handlers.
      device.on('registered', async () => {
        if (!isSetupCurrent()) return
        try {
          await api.voice.registerPresence()
          if (!isSetupCurrent()) return

          // Mark as registered
          presenceOnlineRef.current = true
          setIsRegistered(true)
          setIsRegistering(false)

          // Start heartbeat every 30 seconds
          startPresenceHeartbeat()
        } catch (e) {
          if (!isSetupCurrent()) return
          setIsRegistering(false)
          presenceOnlineRef.current = false
          if (e instanceof ApiError && e.status === 429) {
            schedulePresenceRegisterRetry()
          } else {
            toast.error(t('voiceError.cannotRegister'), 3000)
          }
        }
      })

      device.on('unregistered', async () => {
        setIsRegistered(false)
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }
        // Guard: Skip API call if component unmounted
        if (!mountedRef.current) return
        await markPresenceOffline()
        // Auto re-register if device still exists (AudioContext already created, no gesture needed)
        if (mountedRef.current && deviceRef.current) {
          try {
            setIsRegistering(true)
            await deviceRef.current.register()
          } catch {
            setIsRegistering(false)
          }
        }
      })

      // Register device (establishes signaling connection — no mic access needed)
      await device.register()
      if (!isSetupCurrent()) {
        if (deviceRef.current === device) {
          device.destroy()
          deviceRef.current = null
        }
        return false
      }

        return true
      } catch (e) {
        if (!isSetupCurrent()) return false
        if (import.meta.env.DEV) {
          console.error('[Voice] Device setup failed:', e)
        }
        setError(getErrorMessage(e, t))
        return false
      }
    })()

    deviceSetupPromiseRef.current = setupPromise
    void setupPromise.finally(() => {
      if (deviceSetupPromiseRef.current === setupPromise) {
        deviceSetupPromiseRef.current = null
      }
    })
    return setupPromise
  }, [
    disconnectCallSafely,
    disconnectDeviceSafely,
    finalizeCall,
    markPresenceOffline,
    schedulePresenceRegisterRetry,
    startPresenceHeartbeat,
    t,
  ])

  // Initiate outbound call
  const initiateCall = useCallback(
    async (toPhone: string, caseId: string) => {
      if (
        (callState !== 'idle' && callState !== 'error') ||
        callRef.current ||
        incomingCallRef.current ||
        outboundConnectPendingRef.current
      ) {
        return
      }

      const attemptId = ++outboundAttemptRef.current
      const isCurrentAttempt = () => outboundAttemptRef.current === attemptId
      outboundAttemptActiveRef.current = true

      setError(null)
      setCallState('connecting')
      setDuration(0)
      setIsMuted(false)
      messageIdRef.current = null

      try {
        // Check microphone permission first
        const hasMicPermission = await checkMicrophonePermission()
        if (!isCurrentAttempt()) return
        if (!hasMicPermission) {
          finalizeCall(null, 'error', t('voiceError.micPermissionRequired'))
          return
        }

        // Setup device on first call (user gesture required for AudioContext)
        // This creates Twilio Device and registers it
        const deviceReady = await setupDevice()
        if (!isCurrentAttempt()) return
        if (!deviceReady || !deviceRef.current) {
          finalizeCall(null, 'error', t('voiceError.cannotInitCall'))
          return
        }

        // Check if token needs refresh before call
        if (!isTokenValid(tokenExpiryRef.current)) {
          try {
            const newToken = await api.voice.getToken()
            if (!isCurrentAttempt()) return
            deviceRef.current.updateToken(newToken.token)
            tokenExpiryRef.current = Date.now() + newToken.expiresIn * 1000
          } catch {
            if (!isCurrentAttempt()) return
            finalizeCall(null, 'error', t('voiceError.cannotRefreshSession'))
            return
          }
        }

        // Create call record in backend first (returns messageId for tracking)
        const callRecord = await api.voice.createCall({ caseId, toPhone })
        if (!isCurrentAttempt()) return
        messageIdRef.current = callRecord.messageId

        // Cleanup any existing listeners
        cleanupCallListeners()

        // Ensure audio input is available before connecting
        // In SDK 2.x, we can check/set audio input device
        if (import.meta.env.DEV) {
          try {
            // Log available audio devices
            const devices = await navigator.mediaDevices.enumerateDevices()
            const audioInputs = devices.filter(d => d.kind === 'audioinput')
            console.log('[Voice] Available audio inputs:', audioInputs.map(d => d.label || d.deviceId))
          } catch (e) {
            console.warn('[Voice] Could not enumerate devices:', e)
          }
        }

        // Initiate call via Twilio SDK (SDK 2.x returns Promise<Call>)
        // Select proper mic input before connecting (deferred from registration to avoid
        // prompting mic permission on page load)
        await selectMicrophoneInput(deviceRef.current)
        if (!isCurrentAttempt()) return

        // Note: SDK handles getUserMedia internally
        outboundConnectPendingRef.current = true
        const connectPromise = deviceRef.current.connect({
          params: {
            messageId: callRecord.messageId,
            caseId,
          },
        })
        let connectTimeout: number | null = null
        const timeoutPromise = new Promise<never>((_, reject) => {
          connectTimeout = window.setTimeout(() => {
            reject({ name: 'TIMEOUT' })
          }, OUTBOUND_CONNECT_TIMEOUT_MS)
        })

        let call: TwilioCall
        try {
          call = await Promise.race([connectPromise, timeoutPromise])
        } catch (connectError) {
          if (connectTimeout !== null) {
            clearTimeout(connectTimeout)
          }
          void connectPromise.then((lateCall) => {
            knownCallsRef.current.add(lateCall)
            disconnectStaleCallSafely(lateCall)
          }).catch(() => {})
          throw connectError
        }
        if (connectTimeout !== null) {
          clearTimeout(connectTimeout)
        }
        knownCallsRef.current.add(call)

        if (!isCurrentAttempt()) {
          disconnectStaleCallSafely(call)
          outboundConnectPendingRef.current = false
          return
        }

        outboundConnectPendingRef.current = false
        callRef.current = call

        // Define event handlers and sync the parent SID on ringing or bridge.
        let callSidSynced = false
        const syncCallSid = async () => {
          const callSid = call.parameters?.CallSid
          if (!callSid || callSidSynced) return

          callSidSynced = true
          try {
            await api.voice.updateCallSid(callRecord.messageId, callSid)
            if (import.meta.env.DEV) {
              console.log('[Voice] Updated message with CallSid:', callSid)
            }
          } catch (e) {
            callSidSynced = false
            if (import.meta.env.DEV) {
              console.warn('[Voice] Failed to update CallSid:', e)
            }
          }
        }
        const ringingHandler = async () => {
          setCallState('ringing')
          await syncCallSid()
        }
        const acceptHandler = () => {
          setCallState('connected')
          startTimer()
          void syncCallSid()
          // Debug: Check call and audio status
          if (import.meta.env.DEV && callRef.current) {
            console.log('[Voice] Call connected!')
            console.log('[Voice] Call status:', callRef.current.status?.())
            console.log('[Voice] Call muted:', callRef.current.isMuted?.())

            // Ensure call is not muted
            if (callRef.current.isMuted?.()) {
              console.warn('[Voice] Call was muted, unmuting...')
              callRef.current.mute(false)
            }

            // Check local audio stream
            try {
              const localStream = callRef.current.getLocalStream?.()
              if (localStream) {
                const audioTracks = localStream.getAudioTracks()
                console.log('[Voice] Local audio tracks:', audioTracks.length)
                audioTracks.forEach((track, i) => {
                  console.log(`[Voice] Track ${i}: enabled=${track.enabled}, muted=${track.muted}, readyState=${track.readyState}`)
                  // Ensure track is enabled
                  if (!track.enabled) {
                    console.warn('[Voice] Track was disabled, enabling...')
                    track.enabled = true
                  }
                })
              } else {
                console.warn('[Voice] No local stream available - this is the likely cause of one-way audio!')
              }
            } catch (e) {
              console.warn('[Voice] Could not check local stream:', e)
            }
          }
        }
        const idleHandler = () => {
          finalizeCall(call, 'idle')
        }
        const errorHandler = (err: unknown) => {
          finalizeCall(call, 'error', getErrorMessage(err, t))
        }
        // Warning handler to debug audio issues (SDK 2.x)
        const warningHandler = (warning: unknown) => {
          if (import.meta.env.DEV) {
            console.warn('[Voice] Call warning:', warning)
          }
        }

        // Register listeners and track them for cleanup
        call.on('ringing', ringingHandler)
        call.on('accept', acceptHandler)
        call.on('disconnect', idleHandler)
        call.on('cancel', idleHandler)
        call.on('error', errorHandler)
        call.on('warning', warningHandler)

        // connect() may resolve after an event has already fired. Reconcile the
        // current SDK state once listeners are attached so the UI cannot stick.
        const currentStatus = call.status()
        if (currentStatus === 'ringing') {
          void ringingHandler()
        } else if (currentStatus === 'open') {
          acceptHandler()
        } else if (currentStatus === 'closed') {
          finalizeCall(call, 'idle')
        }
      } catch (e) {
        outboundConnectPendingRef.current = false
        if (!isCurrentAttempt()) return
        finalizeCall(callRef.current, 'error', getErrorMessage(e, t))
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      callState,
      startTimer,
      cleanupCallListeners,
      setupDevice,
      finalizeCall,
      disconnectCallSafely,
      disconnectStaleCallSafely,
    ]
  )

  // End current call
  const endCall = useCallback(() => {
    const call = callRef.current
    if (call) {
      setCallState('disconnecting')
      disconnectCallSafely(call, true)
      finalizeCall(call, 'idle')
    } else if (callState === 'connecting') {
      disconnectDeviceSafely()
      finalizeCall(null, 'idle')
    }
  }, [callState, disconnectCallSafely, disconnectDeviceSafely, finalizeCall])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !callRef.current.isMuted()
      callRef.current.mute(newMuted)
      setIsMuted(newMuted)
    }
  }, [])

  // Accept incoming call
  const acceptIncoming = useCallback(async () => {
    if (!incomingCall) return

    stopRingSound()

    // Select mic input before accepting (deferred from registration)
    if (deviceRef.current) {
      await selectMicrophoneInput(deviceRef.current)
    }

    incomingCall.accept()

    // Transfer to active call ref
    callRef.current = incomingCall
    setCallState('connected')
    startTimer()

    // Setup additional listeners for accepted call
    incomingCall.on('accept', () => {
      setCallState('connected')
      if (import.meta.env.DEV) {
        console.log('[Voice] Incoming call accepted and connected')
      }
    })

    // Clear incoming call state (call is now active)
    setIncomingCall(null)
    incomingCallRef.current = null
  }, [incomingCall, startTimer])

  // Reject incoming call (sends to voicemail)
  const rejectIncoming = useCallback(() => {
    if (!incomingCall) return

    stopRingSound()
    incomingCall.reject() // Sends busy signal - triggers voicemail on Twilio side

    setIncomingCall(null)
    setCallerInfo(null)
    incomingCallRef.current = null

  }, [incomingCall])

  // Auto-register device: try immediately on load, fall back to user gesture if AudioContext blocked
  // Device stays registered until page unload - staff can accept/reject calls via modal
  useEffect(() => {
    // Skip if voice not available or already registered/registering
    if (!isAvailable || isRegistered || isRegistering) {
      return
    }

    const attemptRegistration = async () => {
      // Prevent duplicate registration attempts
      if (autoRegisterTriggeredRef.current) {
        return
      }

      // Check voice availability BEFORE setting flag
      if (!voiceAvailableRef.current) {
        return
      }

      // Mark as triggered and set registering state immediately (before async work)
      autoRegisterTriggeredRef.current = true
      setIsRegistering(true)
      setError(null)

      try {
        // Don't check microphone permission here — registration is just a signaling
        // connection and doesn't need mic access. Checking here triggers the browser
        // permission prompt on every page load (especially on iOS Safari where the
        // Permission API doesn't support 'microphone' queries).
        // Mic permission is checked when the user actually initiates or accepts a call.

        // Setup device (creates Twilio Device, registers it)
        const success = await setupDevice()
        if (!mountedRef.current) return
        if (!success) {
          setIsRegistering(false)
          autoRegisterTriggeredRef.current = false // Allow retry on failure
        }
        // isRegistered will be set in 'registered' event handler
      } catch (e) {
        if (import.meta.env.DEV) {
          console.error('[Voice] Registration error:', e)
        }
        setIsRegistering(false)
        autoRegisterTriggeredRef.current = false // Allow retry on error
      }
    }

    // Try immediate registration (works if user has interacted with site before)
    attemptRegistration().catch(() => {
      // AudioContext blocked - fall back to user gesture
      autoRegisterTriggeredRef.current = false
      setIsRegistering(false)

      const handleUserGesture = () => {
        attemptRegistration()
      }

      document.addEventListener('click', handleUserGesture, { once: true })
      document.addEventListener('keydown', handleUserGesture, { once: true })

      // Store cleanup refs
      gestureCleanupRef.current = () => {
        document.removeEventListener('click', handleUserGesture)
        document.removeEventListener('keydown', handleUserGesture)
      }
    })

    return () => {
      gestureCleanupRef.current?.()
    }
  }, [isAvailable, isRegistered, isRegistering, setupDevice])

  // Re-register when tab becomes visible again (device already exists, no gesture needed)
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      if (!deviceRef.current || isRegistered || isRegistering) return

      setIsRegistering(true)
      deviceRef.current.register().catch(() => {
        setIsRegistering(false)
      })
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isRegistered, isRegistering])

  return [
    { isAvailable, isLoading, callState, isMuted, duration, error, incomingCall, callerInfo, isRegistered, isRegistering },
    { initiateCall, endCall, toggleMute, acceptIncoming, rejectIncoming },
  ]
}
