/**
 * Ring Sound Utility
 * Manages ringtone playback for incoming calls
 * Uses Web Audio API for generated tone (no external file needed)
 * Graceful fallback: logs warning if Web Audio API not supported
 */

let audioContext: AudioContext | null = null
let oscillator: OscillatorNode | null = null
let gainNode: GainNode | null = null
let isPlaying = false
let ringInterval: number | null = null
let isAudioSupported = true // Track Web Audio API support

/**
 * Check if Web Audio API is supported
 */
function checkAudioSupport(): boolean {
  if (typeof window === 'undefined') return false
  return !!(window.AudioContext || (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
}

/**
 * Create a ringing tone pattern (similar to phone ring)
 * Pattern: 400Hz tone, 500ms on, 1000ms off
 * Returns null if Web Audio API not supported
 */
function createRingTone(): { oscillator: OscillatorNode; gainNode: GainNode } | null {
  // Check support first
  if (!isAudioSupported) return null

  try {
    if (!audioContext) {
      // Support both standard and webkit-prefixed AudioContext
      const AudioContextClass = window.AudioContext ||
        (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) {
        isAudioSupported = false
        console.warn('[RingSound] Web Audio API not supported - ring sound disabled')
        return null
      }
      audioContext = new AudioContextClass()
    }

    // Resume AudioContext if suspended (browser autoplay policy)
    if (audioContext.state === 'suspended') {
      audioContext.resume()
    }

    // Create oscillator (generates the tone)
    oscillator = audioContext.createOscillator()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(400, audioContext.currentTime) // 400Hz ring tone

    // Create gain node (controls volume)
    gainNode = audioContext.createGain()
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime) // 30% volume

    // Connect: oscillator -> gain -> speakers
    oscillator.connect(gainNode)
    gainNode.connect(audioContext.destination)

    return { oscillator, gainNode }
  } catch (e) {
    isAudioSupported = false
    console.warn('[RingSound] Failed to create AudioContext:', e)
    return null
  }
}

/**
 * Play ring sound on incoming call
 * Creates a repeating ring pattern: 500ms tone, 1000ms silence
 * Gracefully handles unsupported browsers (no-op)
 */
export function playRingSound(): void {
  if (isPlaying) return

  // Check support early to avoid unnecessary interval
  if (!isAudioSupported && !checkAudioSupport()) {
    console.warn('[RingSound] Skipping ring - Web Audio API not supported')
    return
  }

  isPlaying = true

  function playRingCycle() {
    if (!isPlaying) return

    try {
      const tone = createRingTone()
      // Gracefully handle unsupported browser
      if (!tone) {
        stopRingSound()
        return
      }

      const { oscillator: osc, gainNode: gain } = tone
      oscillator = osc
      gainNode = gain

      oscillator.start()

      // Stop after 500ms
      setTimeout(() => {
        if (oscillator) {
          try {
            oscillator.stop()
            oscillator.disconnect()
          } catch {
            // Already stopped
          }
          oscillator = null
        }
        if (gainNode) {
          gainNode.disconnect()
          gainNode = null
        }
      }, 500)
    } catch (e) {
      // AudioContext might not be available (user blocked audio)
      if (import.meta.env.DEV) {
        console.warn('[RingSound] Failed to play:', e)
      }
    }
  }

  // Start first ring immediately
  playRingCycle()

  // Repeat every 1500ms (500ms tone + 1000ms silence)
  ringInterval = window.setInterval(playRingCycle, 1500)
}

/**
 * Stop ring sound
 */
export function stopRingSound(): void {
  isPlaying = false

  if (ringInterval) {
    clearInterval(ringInterval)
    ringInterval = null
  }

  if (oscillator) {
    try {
      oscillator.stop()
      oscillator.disconnect()
    } catch {
      // Already stopped
    }
    oscillator = null
  }

  if (gainNode) {
    gainNode.disconnect()
    gainNode = null
  }
}

/**
 * Check if ring sound is currently playing
 */
export function isRingSoundPlaying(): boolean {
  return isPlaying
}

/**
 * Cleanup audio resources (call on unmount)
 */
export function cleanupRingSound(): void {
  stopRingSound()

  if (audioContext) {
    try {
      audioContext.close()
    } catch {
      // Already closed
    }
    audioContext = null
  }
}
