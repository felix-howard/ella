/**
 * VoiceCallProvider - Global voice call context provider
 * Wraps app with useVoiceCall hook and renders incoming call modal globally
 * Ensures incoming calls are shown regardless of current route
 * Includes error boundary to prevent voice failures from crashing the app
 */
import { createContext, useContext, Component, type ReactNode, type ErrorInfo } from 'react'
import { useVoiceCall, type VoiceCallState, type VoiceCallActions } from '../../hooks/use-voice-call'
import { IncomingCallModal } from '../messaging/incoming-call-modal'

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

  return (
    <VoiceCallContext.Provider value={{ state, actions }}>
      {children}
      {/* Global incoming call modal - shown regardless of current route */}
      <IncomingCallModal
        call={state.incomingCall}
        callerInfo={state.callerInfo}
        onAccept={actions.acceptIncoming}
        onReject={actions.rejectIncoming}
      />
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
