/**
 * AudioPlayer - Inline audio player for call recordings
 * Compact design for message thread with lazy loading
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { Play, Pause, Loader2, AlertCircle, Volume2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'

export interface AudioPlayerProps {
  recordingSid: string
  duration?: number // Known duration in seconds
  className?: string
}

// Format time as M:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function AudioPlayer({ recordingSid, duration: knownDuration, className }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(knownDuration || 0)
  const [audioSrc, setAudioSrc] = useState<string | null>(null)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  // Load audio on first play (lazy loading with auth)
  const loadAudio = useCallback(async () => {
    if (audioSrc) return true

    try {
      // Fetch audio with auth and create Blob URL
      const blob = await api.voice.fetchRecordingAudio(recordingSid)
      const blobUrl = URL.createObjectURL(blob)
      setAudioSrc(blobUrl)
      return true
    } catch (e) {
      console.error('[AudioPlayer] Failed to load audio:', e)
      setError('Không thể tải bản ghi')
      return false
    }
  }, [recordingSid, audioSrc])

  // Handle play/pause toggle
  const togglePlay = useCallback(async () => {
    // First play - load audio
    if (!audioSrc) {
      setIsLoading(true)
      const loaded = await loadAudio()
      if (!loaded) {
        setIsLoading(false)
        return
      }
      // Wait for next render cycle to have audio element
      return
    }

    if (!audioRef.current) return

    if (isPlaying) {
      audioRef.current.pause()
    } else {
      try {
        await audioRef.current.play()
      } catch (e) {
        console.error('[AudioPlayer] Play failed:', e)
        setError('Không thể phát')
      }
    }
  }, [isPlaying, loadAudio, audioSrc])

  // Auto-play when audio src is set for first time
  useEffect(() => {
    if (audioSrc && audioRef.current && isLoading) {
      audioRef.current.play().catch((e) => {
        console.error('[AudioPlayer] Auto-play failed:', e)
        setIsLoading(false)
      })
    }
  }, [audioSrc, isLoading])

  // Handle seek via progress bar click
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!audioRef.current || !progressRef.current) return

      const rect = progressRef.current.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const percentage = clickX / rect.width
      const audioDuration = audioRef.current.duration || duration
      const newTime = percentage * audioDuration

      audioRef.current.currentTime = newTime
      setCurrentTime(newTime)
    },
    [duration]
  )

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration)
      }
    }
    const handlePlay = () => {
      setIsPlaying(true)
      setIsLoading(false)
    }
    const handlePause = () => setIsPlaying(false)
    const handleEnded = () => {
      setIsPlaying(false)
      setCurrentTime(0)
    }
    const handleError = () => {
      setError('Lỗi phát audio')
      setIsLoading(false)
    }
    const handleLoadStart = () => setIsLoading(true)
    const handleCanPlay = () => setIsLoading(false)

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('durationchange', handleDurationChange)
    audio.addEventListener('play', handlePlay)
    audio.addEventListener('pause', handlePause)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)
    audio.addEventListener('loadstart', handleLoadStart)
    audio.addEventListener('canplay', handleCanPlay)

    return () => {
      // Cleanup to prevent memory leaks
      audio.pause()
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('durationchange', handleDurationChange)
      audio.removeEventListener('play', handlePlay)
      audio.removeEventListener('pause', handlePause)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.removeEventListener('loadstart', handleLoadStart)
      audio.removeEventListener('canplay', handleCanPlay)

      // Revoke blob URL to free memory
      if (audioSrc?.startsWith('blob:')) {
        URL.revokeObjectURL(audioSrc)
      }
      audio.src = ''
    }
  }, [audioSrc])

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className={cn('flex items-center gap-3 p-2 rounded-lg bg-muted/50', className)}>
      {/* Hidden audio element - only rendered when src is loaded */}
      {audioSrc && <audio ref={audioRef} src={audioSrc} preload="metadata" />}

      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        disabled={isLoading}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center transition-colors shrink-0',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isLoading && 'opacity-50 cursor-wait'
        )}
        aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="w-5 h-5" />
        ) : (
          <Play className="w-5 h-5 ml-0.5" />
        )}
      </button>

      {/* Progress bar and time */}
      <div className="flex-1 min-w-0">
        {error ? (
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">{error}</span>
          </div>
        ) : (
          <>
            {/* Progress bar */}
            <div
              ref={progressRef}
              onClick={handleProgressClick}
              className="h-2 bg-muted rounded-full cursor-pointer overflow-hidden"
              role="slider"
              aria-label="Tiến trình phát"
              aria-valuemin={0}
              aria-valuemax={duration}
              aria-valuenow={currentTime}
            >
              <div
                className="h-full bg-primary rounded-full transition-all duration-100"
                style={{ width: `${progress}%` }}
              />
            </div>

            {/* Time display */}
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </>
        )}
      </div>

      {/* Volume indicator (visual only) */}
      <Volume2 className="w-4 h-4 text-muted-foreground hidden sm:block shrink-0" />
    </div>
  )
}
