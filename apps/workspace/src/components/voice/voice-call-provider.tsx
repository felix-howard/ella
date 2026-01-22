/**
 * VoiceCallProvider - Global voice call context provider
 * Wraps app with useVoiceCall hook and renders incoming/active call modals globally
 * Ensures incoming calls are shown regardless of current route
 * Shows active call UI with timer when incoming call is accepted
 * Includes error boundary to prevent voice failures from crashing the app
 */
import { createContext, useContext, Component, type ReactNode, type ErrorInfo, useState, useEffect } from 'react'
import { useVoiceCall, type VoiceCallState, type VoiceCallActions } from '../../hooks/use-voice-call'
import { IncomingCallModal } from '../messaging/incoming-call-modal'
import { ActiveCallModal } from '../messaging/active-call-modal'
import { formatPhone } from '../../lib/formatters'

// Combined context type
interface VoiceCallContextValue {
  state: VoiceCallState
  actions: VoiceCallActions
}

const VoiceCallContext = createContext<VoiceCallContextValue | null>(null)

interface VoiceCallProviderProps {
  children: ReactNode
}

// Error boundary to catch voice-related errors
interface VoiceErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class VoiceErrorBoundary extends Component<{ children: ReactNode }, VoiceErrorBoundaryState> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): VoiceErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[VoiceCallProvider] Error caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Silently fail - voice features disabled but app continues
      // Log was already done in componentDidCatch
      return this.props.children
    }
    return this.props.children
  }
}

function VoiceCallProviderInner({ children }: VoiceCallProviderProps) {
  const [state, actions] = useVoiceCall()

  // Track if this is an inbound call (accepted from incoming modal)
  // We show ActiveCallModal for inbound calls that were accepted
  const [inboundCallActive, setInboundCallActive] = useState(false)
  const [inboundCallerInfo, setInboundCallerInfo] = useState<{
    name: string
    phone: string
  } | null>(null)

  // When incoming call is accepted, track it as inbound active call
  const handleAcceptIncoming = () => {
    // Save caller info before accepting (it will be cleared)
    if (state.callerInfo) {
      setInboundCallerInfo({
        name: state.callerInfo.clientName || 'Khách hàng',
        phone: state.callerInfo.phone,
      })
    }
    setInboundCallActive(true)
    actions.acceptIncoming()
  }

  // Clear inbound call state when call ends
  useEffect(() => {
    if (state.callState === 'idle' && inboundCallActive) {
      // Delay clear to show completion briefly
      const timer = setTimeout(() => {
        setInboundCallActive(false)
        setInboundCallerInfo(null)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [state.callState, inboundCallActive])

  return (
    <VoiceCallContext.Provider value={{ state, actions }}>
      {children}
      {/* Global incoming call modal - shown regardless of current route */}
      <IncomingCallModal
        call={state.incomingCall}
        callerInfo={state.callerInfo}
        onAccept={handleAcceptIncoming}
        onReject={actions.rejectIncoming}
      />
      {/* Active call modal for inbound calls - shows timer and controls */}
      {inboundCallActive && inboundCallerInfo && (
        <ActiveCallModal
          isOpen={true}
          callState={state.callState}
          isMuted={state.isMuted}
          duration={state.duration}
          clientName={inboundCallerInfo.name}
          clientPhone={formatPhone(inboundCallerInfo.phone)}
          error={state.error}
          onEndCall={actions.endCall}
          onToggleMute={actions.toggleMute}
          onClose={() => {
            // Only allow closing if call ended
            if (state.callState === 'idle' || state.callState === 'error') {
              setInboundCallActive(false)
              setInboundCallerInfo(null)
            }
          }}
        />
      )}
    </VoiceCallContext.Provider>
  )
}

export function VoiceCallProvider({ children }: VoiceCallProviderProps) {
  return (
    <VoiceErrorBoundary>
      <VoiceCallProviderInner>{children}</VoiceCallProviderInner>
    </VoiceErrorBoundary>
  )
}

/**
 * Hook to access voice call context
 * @throws if used outside VoiceCallProvider
 */
export function useVoiceCallContext(): VoiceCallContextValue {
  const context = useContext(VoiceCallContext)
  if (!context) {
    throw new Error('useVoiceCallContext must be used within VoiceCallProvider')
  }
  return context
}

/**
 * Hook to access just the voice call state (convenience)
 */
export function useVoiceCallState(): VoiceCallState {
  return useVoiceCallContext().state
}

/**
 * Hook to access just the voice call actions (convenience)
 */
export function useVoiceCallActions(): VoiceCallActions {
  return useVoiceCallContext().actions
}
