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

// Check microphone permission
async function checkMicrophonePermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    // Stop tracks immediately after permission check
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

  // Cleanup call event listeners
  const cleanupCallListeners = useCallback(() => {
    if (callRef.current) {
      callListenersRef.current.forEach(({ event, handler }) => {
        callRef.current?.off(event, handler)
      })
    }
    callListenersRef.current = []
  }, [])

  // Initialize SDK and device
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

        // Load Twilio SDK from CDN
        await loadTwilioSdk()
        if (!mounted) return

        // Get voice token from server
        const tokenResponse = await api.voice.getToken()
        if (!mounted) return

        // Create Twilio Device instance
        const device = new window.Twilio!.Device(tokenResponse.token, {
          logLevel: import.meta.env.DEV ? 3 : 1, // info in dev, error in prod
          codecPreferences: ['opus', 'pcmu'],
          enableRingingState: true,
        })

        // Device ready event
        device.on('ready', () => {
          if (mounted) setIsAvailable(true)
        })

        // Device error event
        device.on('error', (err: unknown) => {
          if (mounted) {
            setError(sanitizeError(err))
            setCallState('error')
          }
        })

        // Token expiry warning - refresh before it expires
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
      if (!deviceRef.current || callState !== 'idle') {
        return
      }

      setError(null)
      setCallState('connecting')
      setDuration(0)
      setIsMuted(false)

      try {
        // Check microphone permission first
        const hasMicPermission = await checkMicrophonePermission()
        if (!hasMicPermission) {
          setError(ERROR_MESSAGES.NotAllowedError)
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

        // Create call record in backend first
        await api.voice.createCall({ caseId, toPhone })

        // Cleanup any existing listeners
        cleanupCallListeners()

        // Initiate call via Twilio SDK
        const call = deviceRef.current.connect({
          params: {
            To: toPhone,
            caseId,
          },
        })

        callRef.current = call

        // Define event handlers with proper cleanup tracking
        const ringingHandler = () => setCallState('ringing')
        const acceptHandler = () => {
          setCallState('connected')
          startTimer()
        }
        const disconnectHandler = () => {
          setCallState('idle')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
        }
        const cancelHandler = () => {
          setCallState('idle')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
        }
        const errorHandler = (err: unknown) => {
          setError(sanitizeError(err))
          setCallState('error')
          stopTimer()
          setIsMuted(false)
          cleanupCallListeners()
          callRef.current = null
        }

        // Register listeners and track them for cleanup
        call.on('ringing', ringingHandler)
        call.on('accept', acceptHandler)
        call.on('disconnect', disconnectHandler)
        call.on('cancel', cancelHandler)
        call.on('error', errorHandler)

        callListenersRef.current = [
          { event: 'ringing', handler: ringingHandler },
          { event: 'accept', handler: acceptHandler },
          { event: 'disconnect', handler: disconnectHandler },
          { event: 'cancel', handler: cancelHandler },
          { event: 'error', handler: errorHandler as () => void },
        ]
      } catch (e) {
        setError(sanitizeError(e))
        setCallState('error')
      }
    },
    [callState, startTimer, stopTimer, cleanupCallListeners]
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
