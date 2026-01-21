/**
 * useVoiceCall Hook
 * Manages Twilio Voice SDK device and call state for browser-based voice calls
 * Features: mic permission check, token refresh, error sanitization, proper cleanup
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api-client'
import {
  loadTwilioSdk,
  type TwilioDeviceInstance,
  type TwilioCall,
  type TwilioCallEvent,
} from '../lib/twilio-sdk-loader'

export type CallState =
  | 'idle'
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'disconnecting'
  | 'error'

export interface VoiceCallState {
  isAvailable: boolean
  isLoading: boolean
  callState: CallState
  isMuted: boolean
  duration: number
  error: string | null
}

export interface VoiceCallActions {
  initiateCall: (toPhone: string, caseId: string) => Promise<void>
  endCall: () => void
  toggleMute: () => void
}

// User-friendly error messages (Vietnamese)
const ERROR_MESSAGES: Record<string, string> = {
  NotAllowedError: 'Bạn cần cấp quyền microphone để gọi điện',
  NotFoundError: 'Không tìm thấy microphone',
  NotSupportedError: 'Trình duyệt không hỗ trợ gọi điện',
  OverconstrainedError: 'Không thể truy cập microphone',
  SecurityError: 'Lỗi bảo mật khi truy cập microphone',
  AbortError: 'Truy cập microphone bị hủy',
  InvalidStateError: 'Thiết bị đang được sử dụng',
  NETWORK_ERROR: 'Lỗi kết nối mạng',
  TIMEOUT: 'Hết thời gian chờ',
  default: 'Lỗi cuộc gọi. Vui lòng thử lại',
}

// Sanitize error to user-friendly message
function sanitizeError(error: unknown): string {
  if (!error) return ERROR_MESSAGES.default

  const errObj = error as { name?: string; message?: string; code?: string }
  const errorKey = errObj.name || errObj.code || ''

  return ERROR_MESSAGES[errorKey] || ERROR_MESSAGES.default
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

// Check if token is still valid (with 5 min buffer)
function isTokenValid(expiryTime: number): boolean {
  const bufferMs = 5 * 60 * 1000 // 5 minutes
  return Date.now() < expiryTime - bufferMs
}

export function useVoiceCall(): [VoiceCallState, VoiceCallActions] {
  const [isAvailable, setIsAvailable] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [callState, setCallState] = useState<CallState>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const deviceRef = useRef<TwilioDeviceInstance | null>(null)
  const callRef = useRef<TwilioCall | null>(null)
  const timerRef = useRef<number | null>(null)
  const tokenExpiryRef = useRef<number>(0)
  const callListenersRef = useRef<{ event: TwilioCallEvent; handler: () => void }[]>([])
  const messageIdRef = useRef<string | null>(null) // Track message ID for CallSid update

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
    callListenersRef.current = []
  }, [])

  // Track if voice feature is available on server
  const voiceAvailableRef = useRef(false)

  // Check voice availability and preload SDK (but DON'T create Device - AudioContext issue)
  useEffect(() => {
    let mounted = true

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
        if (mounted) {
          if (import.meta.env.DEV) {
            console.error('[Voice] Init failed:', e)
          }
          setError(sanitizeError(e))
          setIsAvailable(false)
          setIsLoading(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
      cleanupCallListeners()
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
      if (deviceRef.current) {
        deviceRef.current.destroy()
      }
    }
  }, [cleanupCallListeners])

  // Create and setup Twilio Device (called on first user gesture)
  const setupDevice = useCallback(async (): Promise<boolean> => {
    if (deviceRef.current) return true // Already setup
    if (!voiceAvailableRef.current) return false

    try {
      // Get voice token from server
      const tokenResponse = await api.voice.getToken()

      // Create Twilio Device instance (SDK 2.x)
      // This creates AudioContext - MUST be after user gesture
      const device = new window.Twilio!.Device(tokenResponse.token, {
        logLevel: import.meta.env.DEV ? 3 : 1,
        codecPreferences: ['opus', 'pcmu'],
        edge: 'roaming',
      })

      // Setup event handlers
      device.on('error', (err: unknown) => {
        setError(sanitizeError(err))
        setCallState('error')
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

      // Register device (establishes signaling connection)
      await device.register()

      if (import.meta.env.DEV) {
        console.log('[Voice] Device created and registered after user gesture')
      }

      // Select proper microphone input (avoid "Stereo Mix" which captures system audio)
      try {
        const inputDevices = device.audio?.availableInputDevices
        if (inputDevices && inputDevices.size > 0) {
          // Find a real microphone (not Stereo Mix)
          let selectedDevice: MediaDeviceInfo | null = null

          for (const [deviceId, deviceInfo] of inputDevices) {
            const label = deviceInfo.label.toLowerCase()
            if (import.meta.env.DEV) {
              console.log(`[Voice] Input device: ${deviceInfo.label} (${deviceId})`)
            }

            // Skip Stereo Mix - it captures system audio, not microphone
            if (label.includes('stereo mix')) {
              continue
            }

            // Prefer actual microphone or default
            if (label.includes('microphone') || label.includes('default')) {
              selectedDevice = deviceInfo
              break
            }

            // Use any non-Stereo Mix device as fallback
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
        }
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[Voice] Could not set input device:', e)
        }
      }

      return true
    } catch (e) {
      if (import.meta.env.DEV) {
        console.error('[Voice] Device setup failed:', e)
      }
      setError(sanitizeError(e))
      return false
    }
  }, [])

  // Start duration timer
  const startTimer = useCallback(() => {
    setDuration(0)
    timerRef.current = window.setInterval(() => {
      setDuration((d) => d + 1)
    }, 1000)
  }, [])

  // Stop duration timer
  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Initiate outbound call
  const initiateCall = useCallback(
    async (toPhone: string, caseId: string) => {
      if (callState !== 'idle') {
        return
      }

      setError(null)
      setCallState('connecting')
      setDuration(0)
      setIsMuted(false)
      messageIdRef.current = null

      try {
        // Check microphone permission first
        const hasMicPermission = await checkMicrophonePermission()
        if (!hasMicPermission) {
          setError(ERROR_MESSAGES.NotAllowedError)
          setCallState('error')
          return
        }

        // Setup device on first call (user gesture required for AudioContext)
        // This creates Twilio Device and registers it
        const deviceReady = await setupDevice()
        if (!deviceReady || !deviceRef.current) {
          setError('Không thể khởi tạo cuộc gọi. Vui lòng tải lại trang')
          setCallState('error')
          return
        }

        // Check if token needs refresh before call
        if (!isTokenValid(tokenExpiryRef.current)) {
          try {
            const newToken = await api.voice.getToken()
            deviceRef.current.updateToken(newToken.token)
            tokenExpiryRef.current = Date.now() + newToken.expiresIn * 1000
          } catch {
            setError('Không thể làm mới phiên gọi. Vui lòng tải lại trang')
            setCallState('error')
            return
          }
        }

        // Create call record in backend first (returns messageId for tracking)
        const callRecord = await api.voice.createCall({ caseId, toPhone })
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
        // Note: SDK handles getUserMedia internally
        const call = await deviceRef.current.connect({
          params: {
            To: toPhone,
            caseId,
          },
        })

        callRef.current = call

        // Define event handlers with proper cleanup tracking
        // Update CallSid in 'ringing' handler when it's guaranteed to be available
        const ringingHandler = async () => {
          setCallState('ringing')
          // Update message with Twilio CallSid for webhook tracking
          const callSid = callRef.current?.parameters?.CallSid
          if (callSid && messageIdRef.current) {
            try {
              await api.voice.updateCallSid(messageIdRef.current, callSid)
              if (import.meta.env.DEV) {
                console.log('[Voice] Updated message with CallSid:', callSid)
              }
            } catch (e) {
              if (import.meta.env.DEV) {
                console.warn('[Voice] Failed to update CallSid:', e)
              }
            }
          }
        }
        const acceptHandler = () => {
          setCallState('connected')
          startTimer()
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
        const disconnectHandler = () => {
          setCallState('idle')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
          messageIdRef.current = null
        }
        const cancelHandler = () => {
          setCallState('idle')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
          messageIdRef.current = null
        }
        const errorHandler = (err: unknown) => {
          setError(sanitizeError(err))
          setCallState('error')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
          messageIdRef.current = null
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
        call.on('disconnect', disconnectHandler)
        call.on('cancel', cancelHandler)
        call.on('error', errorHandler)
        call.on('warning', warningHandler)

        callListenersRef.current = [
          { event: 'ringing', handler: ringingHandler as () => void },
          { event: 'accept', handler: acceptHandler },
          { event: 'disconnect', handler: disconnectHandler },
          { event: 'cancel', handler: cancelHandler },
          { event: 'error', handler: errorHandler as () => void },
          { event: 'warning', handler: warningHandler as () => void },
        ]
      } catch (e) {
        setError(sanitizeError(e))
        setCallState('error')
      }
    },
    [callState, startTimer, stopTimer, cleanupCallListeners, setupDevice]
  )

  // End current call
  const endCall = useCallback(() => {
    if (callRef.current) {
      setCallState('disconnecting')
      callRef.current.disconnect()
    }
  }, [])

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (callRef.current) {
      const newMuted = !callRef.current.isMuted()
      callRef.current.mute(newMuted)
      setIsMuted(newMuted)
    }
  }, [])

  return [
    { isAvailable, isLoading, callState, isMuted, duration, error },
    { initiateCall, endCall, toggleMute },
  ]
}
