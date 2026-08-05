// @vitest-environment happy-dom
import { act, StrictMode, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TwilioCallEvent, TwilioCallStatus } from '../lib/twilio-sdk-loader'
import {
  useVoiceCall,
  type VoiceCallActions,
  type VoiceCallState,
} from './use-voice-call'

;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => ({
  getStatus: vi.fn(),
  getToken: vi.fn(),
  createCall: vi.fn(),
  updateCallSid: vi.fn(),
  registerPresence: vi.fn(),
  unregisterPresence: vi.fn(),
  heartbeat: vi.fn(),
  lookupCaller: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('../lib/twilio-sdk-loader', () => ({
  loadTwilioSdk: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../lib/ring-sound', () => ({
  playRingSound: vi.fn(),
  stopRingSound: vi.fn(),
  cleanupRingSound: vi.fn(),
}))
vi.mock('../stores/toast-store', () => ({
  toast: { error: vi.fn() },
}))
vi.mock('../lib/api-client', () => ({
  ApiError: class ApiError extends Error {
    status = 500
  },
  api: { voice: mocks },
}))

type Handler = (...args: unknown[]) => unknown

class FakeCall {
  private handlers = new Map<TwilioCallEvent, Set<Handler>>()
  private currentStatus: TwilioCallStatus
  parameters = { CallSid: 'CA-parent', From: '+15550000000' }
  disconnect = vi.fn()
  mute = vi.fn()
  isMuted = vi.fn(() => false)
  accept = vi.fn()
  reject = vi.fn()
  getLocalStream = vi.fn(() => null)
  getRemoteStream = vi.fn(() => null)

  constructor(status: TwilioCallStatus) {
    this.currentStatus = status
  }

  status = () => this.currentStatus
  on = (event: TwilioCallEvent, handler: Handler) => {
    const handlers = this.handlers.get(event) ?? new Set()
    handlers.add(handler)
    this.handlers.set(event, handlers)
  }
  removeListener = (event: TwilioCallEvent, handler: Handler) => {
    this.handlers.get(event)?.delete(handler)
  }
  removeAllListeners = (event?: TwilioCallEvent) => {
    if (event) this.handlers.delete(event)
    else this.handlers.clear()
  }
  emit = async (event: TwilioCallEvent, status?: TwilioCallStatus, value?: unknown) => {
    if (status) this.currentStatus = status
    const handlers = [...(this.handlers.get(event) ?? [])]
    await Promise.all(handlers.map((handler) => handler(value)))
  }
}

class FakeDevice {
  static instances: FakeDevice[] = []
  private handlers = new Map<string, Set<Handler>>()
  call: FakeCall
  state = 'registered'
  isBusy = false
  identity = 'staff'
  audio = {
    availableInputDevices: new Map(),
    availableOutputDevices: new Map(),
    setInputDevice: vi.fn(),
    unsetInputDevice: vi.fn(),
    speakerDevices: { set: vi.fn() },
    ringtoneDevices: { set: vi.fn() },
  }
  connect = vi.fn(async () => this.call)
  disconnectAll = vi.fn()
  updateToken = vi.fn()
  register = vi.fn(async () => undefined)
  unregister = vi.fn(async () => undefined)
  destroy = vi.fn()
  off = vi.fn()

  constructor(_token: string) {
    this.call = nextCall
    FakeDevice.instances.push(this)
  }

  on = (event: string, handler: Handler) => {
    const handlers = this.handlers.get(event) ?? new Set()
    handlers.add(handler)
    this.handlers.set(event, handlers)
  }
  emit = async (event: string, ...args: unknown[]) => {
    await Promise.all([...(this.handlers.get(event) ?? [])].map((handler) => handler(...args)))
  }
}

let nextCall = new FakeCall('connecting')
let root: Root | null = null
let captured: { state: VoiceCallState; actions: VoiceCallActions } | null = null

function Probe() {
  const [state, actions] = useVoiceCall()
  useEffect(() => {
    captured = { state, actions }
  }, [actions, state])
  return null
}

async function mountHook(
  status: TwilioCallStatus = 'connecting',
  strictMode = false,
) {
  nextCall = new FakeCall(status)
  const container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  await act(async () => {
    root?.render(strictMode
      ? <StrictMode><Probe /></StrictMode>
      : <Probe />)
    await Promise.resolve()
  })
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
  return nextCall
}

async function initiate() {
  await act(async () => captured?.actions.initiateCall('+15551112222', 'case-1'))
}

beforeEach(() => {
  vi.useFakeTimers()
  FakeDevice.instances = []
  captured = null
  mocks.getStatus.mockResolvedValue({ available: true })
  mocks.getToken.mockResolvedValue({ token: 'token', expiresIn: 3600 })
  mocks.createCall.mockResolvedValue({ messageId: 'message-1' })
  mocks.updateCallSid.mockResolvedValue(undefined)
  mocks.registerPresence.mockResolvedValue(undefined)
  mocks.unregisterPresence.mockResolvedValue(undefined)
  mocks.heartbeat.mockResolvedValue(undefined)
  mocks.lookupCaller.mockResolvedValue({ conversation: null })
  Object.defineProperty(window, 'Twilio', {
    configurable: true,
    value: { Device: FakeDevice },
  })
  Object.defineProperty(navigator, 'permissions', {
    configurable: true,
    value: { query: vi.fn().mockResolvedValue({ state: 'granted' }) },
  })
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { enumerateDevices: vi.fn().mockResolvedValue([]) },
  })
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  document.body.replaceChildren()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('useVoiceCall outbound lifecycle', () => {
  it('shares one in-flight Device setup between registration and outbound calling', async () => {
    let resolveToken: ((value: { token: string; expiresIn: number }) => void) | undefined
    mocks.getToken.mockReturnValueOnce(new Promise((resolve) => {
      resolveToken = resolve
    }))
    const call = await mountHook('open')
    let pendingInitiation: Promise<void> | undefined

    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(mocks.getToken).toHaveBeenCalledOnce()
    expect(FakeDevice.instances).toHaveLength(0)

    await act(async () => {
      resolveToken?.({ token: 'shared-token', expiresIn: 3600 })
      await pendingInitiation
    })
    expect(FakeDevice.instances).toHaveLength(1)
    expect(FakeDevice.instances[0].connect).toHaveBeenCalledOnce()
    expect(FakeDevice.instances[0].call).toBe(call)
  })

  it('creates a usable final Device lifecycle under React Strict Mode', async () => {
    const call = await mountHook('open', true)
    expect(FakeDevice.instances).toHaveLength(1)
    const device = FakeDevice.instances[0]
    expect(device.destroy).not.toHaveBeenCalled()

    await initiate()
    expect(device.connect).toHaveBeenCalledOnce()
    expect(captured?.state.callState).toBe('connected')
    expect(device.call).toBe(call)
  })

  it('keeps ringing timer-free, then starts exactly one timer after bridge', async () => {
    const call = await mountHook()
    await initiate()
    await act(async () => call.emit('ringing', 'ringing'))
    expect(captured?.state.callState).toBe('ringing')
    await act(async () => vi.advanceTimersByTime(2000))
    expect(captured?.state.duration).toBe(0)

    await act(async () => call.emit('accept', 'open'))
    await act(async () => call.emit('accept', 'open'))
    await act(async () => vi.advanceTimersByTime(2000))
    expect(captured?.state.callState).toBe('connected')
    expect(captured?.state.duration).toBe(2)
  })

  it.each(['cancel', 'disconnect'] as const)(
    'returns to idle once on %s and stops the timer',
    async (event) => {
      const call = await mountHook('open')
      await initiate()
      await act(async () => vi.advanceTimersByTime(1000))
      await act(async () => call.emit(event, 'closed'))
      await act(async () => vi.advanceTimersByTime(2000))
      expect(captured?.state.callState).toBe('idle')
      expect(captured?.state.duration).toBe(1)
    },
  )

  it.each([
    ['open', 'connected'],
    ['closed', 'idle'],
    ['ringing', 'ringing'],
  ] as const)('reconciles an already-%s call after listener registration', async (status, expected) => {
    await mountHook(status)
    await initiate()
    expect(captured?.state.callState).toBe(expected)
  })

  it('finalizes a local hangup when the SDK event is missing and disconnect throws', async () => {
    const call = await mountHook('open')
    await initiate()
    call.disconnect.mockImplementation(() => {
      throw new Error('provider disconnect failed')
    })
    expect(() => act(() => captured?.actions.endCall())).not.toThrow()
    expect(call.disconnect).toHaveBeenCalledOnce()
    expect(captured?.state.callState).toBe('idle')
  })

  it('rejects incoming overlap and cancels before the SDK returns a call', async () => {
    const call = await mountHook()
    const device = FakeDevice.instances[0]
    let resolveConnect: ((call: FakeCall) => void) | undefined
    device.connect.mockReturnValue(new Promise((resolve) => {
      resolveConnect = resolve
    }))
    let pendingInitiation: Promise<void> | undefined

    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(captured?.state.callState).toBe('connecting')
    const incomingCall = new FakeCall('pending')
    await act(async () => device.emit('incoming', incomingCall))
    expect(incomingCall.reject).toHaveBeenCalledOnce()
    expect(captured?.state.incomingCall).toBeNull()

    act(() => captured?.actions.endCall())
    expect(captured?.state.callState).toBe('idle')

    call.disconnect.mockImplementation(() => {
      throw new Error('late call disconnect failed')
    })
    await act(async () => {
      resolveConnect?.(call)
      await pendingInitiation
    })
    expect(call.disconnect).toHaveBeenCalledOnce()
    expect(device.disconnectAll).toHaveBeenCalledTimes(2)
    expect(captured?.state.callState).toBe('idle')
  })

  it('releases call guards when a canceled SDK connect never settles', async () => {
    await mountHook()
    const device = FakeDevice.instances[0]
    device.connect.mockReturnValue(new Promise(() => {}))
    let pendingInitiation: Promise<void> | undefined

    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(captured?.state.callState).toBe('connecting')

    act(() => captured?.actions.endCall())
    expect(captured?.state.callState).toBe('idle')
    const incomingCall = new FakeCall('pending')
    await act(async () => device.emit('incoming', incomingCall))
    expect(incomingCall.reject).not.toHaveBeenCalled()
    expect(captured?.state.incomingCall).toBe(incomingCall)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000)
      await pendingInitiation
    })
    expect(captured?.state.callState).toBe('idle')
  })

  it('does not disconnect a replacement when stale call cleanup fails', async () => {
    const staleCall = await mountHook()
    const device = FakeDevice.instances[0]
    let resolveStaleCall: ((call: FakeCall) => void) | undefined
    device.connect.mockReturnValueOnce(new Promise((resolve) => {
      resolveStaleCall = resolve
    }))
    let staleInitiation: Promise<void> | undefined

    await act(async () => {
      staleInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })
    act(() => captured?.actions.endCall())
    expect(captured?.state.callState).toBe('idle')

    const replacementCall = new FakeCall('open')
    device.connect.mockResolvedValueOnce(replacementCall)
    await initiate()
    expect(captured?.state.callState).toBe('connected')

    staleCall.disconnect.mockImplementation(() => {
      throw new Error('stale disconnect failed')
    })
    await act(async () => {
      resolveStaleCall?.(staleCall)
      await staleInitiation
    })

    expect(staleCall.disconnect).toHaveBeenCalledOnce()
    expect(device.disconnectAll).toHaveBeenCalledOnce()
    expect(replacementCall.disconnect).not.toHaveBeenCalled()
    expect(captured?.state.callState).toBe('connected')
  })

  it('allows a new call after sanitized SDK error cleanup', async () => {
    const failedCall = await mountHook()
    await initiate()
    await act(async () => failedCall.emit('error', 'closed', new Error('raw provider detail')))
    expect(captured?.state.callState).toBe('error')
    expect(captured?.state.error).toBe('voiceError.default')

    const retryCall = new FakeCall('open')
    FakeDevice.instances[0].call = retryCall
    await initiate()
    expect(captured?.state.callState).toBe('connected')
  })

  it('ignores a delayed device error scoped to an older call', async () => {
    const oldCall = await mountHook('open')
    const device = FakeDevice.instances[0]
    await initiate()
    await act(async () => oldCall.emit('disconnect', 'closed'))

    const currentCall = new FakeCall('open')
    device.call = currentCall
    await initiate()
    await act(async () => device.emit(
      'error',
      new Error('stale call error'),
      oldCall,
    ))

    expect(oldCall.disconnect).toHaveBeenCalledOnce()
    expect(currentCall.disconnect).not.toHaveBeenCalled()
    expect(captured?.state.callState).toBe('connected')
  })

  it('does not cancel a pending replacement for a known older call error', async () => {
    const oldCall = await mountHook('open')
    const device = FakeDevice.instances[0]
    await initiate()
    await act(async () => oldCall.emit('disconnect', 'closed'))

    const replacementCall = new FakeCall('open')
    device.call = replacementCall
    let resolveConnect: ((call: FakeCall) => void) | undefined
    device.connect.mockReturnValue(new Promise((resolve) => {
      resolveConnect = resolve
    }))
    let pendingInitiation: Promise<void> | undefined
    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => device.emit(
      'error',
      new Error('older call error'),
      oldCall,
    ))
    expect(captured?.state.callState).toBe('connecting')
    await act(async () => {
      resolveConnect?.(replacementCall)
      await pendingInitiation
    })
    expect(captured?.state.callState).toBe('connected')
  })

  it('keeps the error state when disconnect emits synchronously', async () => {
    const call = await mountHook('open')
    const device = FakeDevice.instances[0]
    await initiate()
    call.disconnect.mockImplementation(() => {
      void call.emit('disconnect', 'closed')
    })

    await act(async () => device.emit(
      'error',
      new Error('current call error'),
      call,
    ))
    expect(call.disconnect).toHaveBeenCalledOnce()
    expect(captured?.state.callState).toBe('error')
    expect(captured?.state.error).toBe('voiceError.default')
  })

  it('clears the outbound guard after a device-level error', async () => {
    const outboundCall = await mountHook()
    const device = FakeDevice.instances[0]
    let resolveConnect: ((call: FakeCall) => void) | undefined
    device.connect.mockReturnValue(new Promise((resolve) => {
      resolveConnect = resolve
    }))
    let pendingInitiation: Promise<void> | undefined
    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => device.emit('error', new Error('raw device detail')))
    expect(captured?.state.callState).toBe('error')
    expect(captured?.state.error).toBe('voiceError.default')
    const overlappingIncomingCall = new FakeCall('pending')
    await act(async () => device.emit('incoming', overlappingIncomingCall))
    expect(overlappingIncomingCall.reject).not.toHaveBeenCalled()
    expect(captured?.state.incomingCall).toBe(overlappingIncomingCall)

    await act(async () => {
      resolveConnect?.(outboundCall)
      await pendingInitiation
    })
    expect(outboundCall.disconnect).toHaveBeenCalledOnce()

    const laterIncomingCall = new FakeCall('pending')
    await act(async () => device.emit('incoming', laterIncomingCall))
    expect(laterIncomingCall.reject).toHaveBeenCalledOnce()
    expect(captured?.state.incomingCall).toBe(overlappingIncomingCall)
  })

  it('invalidates and cleans up a pending connect after unmount', async () => {
    const call = await mountHook()
    const device = FakeDevice.instances[0]
    let resolveConnect: ((call: FakeCall) => void) | undefined
    device.connect.mockReturnValue(new Promise((resolve) => {
      resolveConnect = resolve
    }))
    let pendingInitiation: Promise<void> | undefined
    await act(async () => {
      pendingInitiation = captured?.actions.initiateCall('+15551112222', 'case-1')
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => root?.unmount())
    root = null
    await act(async () => {
      resolveConnect?.(call)
      await pendingInitiation
    })
    expect(device.destroy).toHaveBeenCalledOnce()
    expect(call.disconnect).toHaveBeenCalledOnce()
  })

  it('does not create a Device when token loading finishes after unmount', async () => {
    let resolveToken: ((value: { token: string; expiresIn: number }) => void) | undefined
    mocks.getToken.mockReturnValue(new Promise((resolve) => {
      resolveToken = resolve
    }))
    await mountHook()
    expect(FakeDevice.instances).toHaveLength(0)

    await act(async () => root?.unmount())
    root = null
    await act(async () => {
      resolveToken?.({ token: 'late-token', expiresIn: 3600 })
      await Promise.resolve()
    })
    expect(FakeDevice.instances).toHaveLength(0)
  })

  it('preserves incoming-call registration, acceptance, and cleanup', async () => {
    await mountHook()
    const device = FakeDevice.instances[0]
    const incomingCall = new FakeCall('pending')
    await act(async () => device.emit('incoming', incomingCall))
    expect(device.register).toHaveBeenCalledOnce()
    expect(captured?.state.incomingCall).toBe(incomingCall)
    await initiate()
    expect(device.connect).not.toHaveBeenCalled()

    await act(async () => captured?.actions.acceptIncoming())
    expect(incomingCall.accept).toHaveBeenCalledOnce()
    expect(captured?.state.callState).toBe('connected')
    await act(async () => incomingCall.emit('disconnect', 'closed'))
    expect(captured?.state.callState).toBe('idle')
  })
})
