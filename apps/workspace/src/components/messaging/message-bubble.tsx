/**
 * Message Bubble - Modern chat UI component
 * Inspired by WhatsApp, iMessage, Telegram for clean visual design
 */

import { memo, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Phone, Globe, Bot, ImageOff, PhoneCall, PhoneOff, PhoneMissed } from 'lucide-react'
import { sanitizeText } from '../../lib/formatters'
import type { Message } from '../../lib/api-client'
import { fetchMediaBlobUrl } from '../../lib/api-client'
import { AudioPlayer } from './audio-player'

export interface MessageBubbleProps {
  message: Message
  showTime?: boolean
}

// Channel icons (labels are i18n keys)
const CHANNEL_ICONS = {
  SMS: { icon: Phone, labelKey: 'messages.channel.sms', color: 'text-primary' },
  PORTAL: { icon: Globe, labelKey: 'messages.channel.portal', color: 'text-accent' },
  SYSTEM: { icon: Bot, labelKey: 'messages.channel.system', color: 'text-muted-foreground' },
  CALL: { icon: PhoneCall, labelKey: 'messages.channel.call', color: 'text-green-600' },
} as const

// Call status mapping (labels are i18n keys)
const CALL_STATUS_CONFIG: Record<string, { icon: React.ReactNode; labelKey: string; color: string }> = {
  completed: { icon: <PhoneCall className="w-4 h-4" />, labelKey: 'messages.callStatus.completed', color: 'text-green-600' },
  busy: { icon: <PhoneOff className="w-4 h-4" />, labelKey: 'messages.callStatus.busy', color: 'text-yellow-600' },
  'no-answer': { icon: <PhoneMissed className="w-4 h-4" />, labelKey: 'messages.callStatus.noAnswer', color: 'text-orange-600' },
  failed: { icon: <PhoneOff className="w-4 h-4" />, labelKey: 'messages.callStatus.failed', color: 'text-destructive' },
  canceled: { icon: <PhoneOff className="w-4 h-4" />, labelKey: 'messages.callStatus.failed', color: 'text-destructive' },
  initiated: { icon: <PhoneCall className="w-4 h-4" />, labelKey: 'messages.callStatus.calling', color: 'text-blue-600' },
  ringing: { icon: <PhoneCall className="w-4 h-4" />, labelKey: 'messages.callStatus.calling', color: 'text-blue-600' },
  'in-progress': { icon: <PhoneCall className="w-4 h-4" />, labelKey: 'messages.callStatus.connecting', color: 'text-green-600' },
  voicemail: { icon: <PhoneMissed className="w-4 h-4" />, labelKey: 'messages.callStatus.voicemail', color: 'text-orange-600' },
}

const DEFAULT_CALL_STATUS = { icon: <PhoneCall className="w-4 h-4" />, labelKey: 'messages.channel.call', color: 'text-muted-foreground' }

// Format call duration as M:SS
function formatCallDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export const MessageBubble = memo(function MessageBubble({ message, showTime = true }: MessageBubbleProps) {
  const { t } = useTranslation()
  const isOutbound = message.direction === 'OUTBOUND'
  const isSystem = message.channel === 'SYSTEM'
  const channelConfig = CHANNEL_ICONS[message.channel]
  const ChannelIcon = channelConfig.icon
  const channelLabel = t(channelConfig.labelKey)
  const hasAttachments = message.attachmentUrls && message.attachmentUrls.length > 0

  // Format time
  const time = new Date(message.createdAt).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  // Sanitize content to prevent XSS
  const safeContent = sanitizeText(message.content)
  const hasText = safeContent && safeContent.trim().length > 0
  const isImageOnly = hasAttachments && !hasText

  // System messages have centered, muted style
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-xs text-muted-foreground">
          <Bot className="w-3 h-3" />
          <span>{safeContent}</span>
          {showTime && <span className="ml-1">• {time}</span>}
        </div>
      </div>
    )
  }

  // Call messages with special styling and audio player
  if (message.channel === 'CALL') {
    const callStatusConfig = CALL_STATUS_CONFIG[message.callStatus || ''] || DEFAULT_CALL_STATUS
    const callStatusLabel = t(callStatusConfig.labelKey)
    const hasRecording = message.recordingUrl && (message.callStatus === 'completed' || message.callStatus === 'voicemail')
    // Extract recording SID from URL (format: .../Recordings/RE.../...)
    const recordingSid = message.recordingUrl?.match(/RE[0-9a-fA-F]{32}/)?.[0]

    return (
      <div className={cn('flex flex-col w-full gap-1', isOutbound ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'max-w-[320px] w-full overflow-hidden',
            'rounded-[20px]',
            isOutbound ? 'rounded-br-[6px]' : 'rounded-bl-[6px]',
            isOutbound ? 'bg-primary/10' : 'bg-card border border-border'
          )}
        >
          <div className="px-4 py-3">
            {/* Call header with icon and status */}
            <div className="flex items-center gap-2 mb-2">
              <span className={callStatusConfig.color}>{callStatusConfig.icon}</span>
              <span className="text-sm font-medium">{callStatusLabel}</span>
              {message.recordingDuration && message.recordingDuration > 0 && (
                <span className="text-xs text-muted-foreground">
                  ({formatCallDuration(message.recordingDuration)})
                </span>
              )}
            </div>

            {/* Audio player if recording exists */}
            {hasRecording && recordingSid && (
              <AudioPlayer
                recordingSid={recordingSid}
                duration={message.recordingDuration}
                className="mt-2"
              />
            )}

            {/* Timestamp */}
            <div className="flex justify-end mt-2">
              <span className="text-xs text-muted-foreground">{time}</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Image-only message - clean modern style without card wrapper
  if (isImageOnly) {
    return (
      <div
        className={cn(
          'flex flex-col w-full gap-1',
          isOutbound ? 'items-end' : 'items-start'
        )}
      >
        {/* Images displayed standalone */}
        <div className="flex flex-col gap-1.5 max-w-[280px]">
          {message.attachmentUrls!.map((url, index) => (
            <MessageImage
              key={index}
              url={url}
              isOutbound={isOutbound}
              isStandalone
            />
          ))}
        </div>

        {/* Metadata below image */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-[10px] text-muted-foreground px-1',
            isOutbound && 'flex-row-reverse'
          )}
        >
          <ChannelIcon className="w-3 h-3" />
          <span>{channelLabel}</span>
          {showTime && <span>{time}</span>}
        </div>
      </div>
    )
  }

  // Text message (with optional images)
  return (
    <div
      className={cn(
        'flex flex-col w-full gap-1',
        isOutbound ? 'items-end' : 'items-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] overflow-hidden',
          // Modern bubble shape with chat tail
          isOutbound
            ? 'rounded-[20px] rounded-br-[6px]'
            : 'rounded-[20px] rounded-bl-[6px]',
          // Colors - card style for text messages
          isOutbound
            ? 'bg-primary text-white'
            : 'bg-card border border-border text-foreground'
        )}
      >
        {/* Images at top, edge-to-edge within bubble */}
        {hasAttachments && (
          <div className="flex flex-col">
            {message.attachmentUrls!.map((url, index) => (
              <MessageImage
                key={index}
                url={url}
                isOutbound={isOutbound}
                isStandalone={false}
              />
            ))}
          </div>
        )}

        {/* Text content with padding */}
        <div className="px-3.5 py-2">
          {hasText && (
            <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
              {safeContent}
            </p>
          )}

          {/* Inline metadata */}
          <div
            className={cn(
              'flex items-center gap-1.5 mt-1 text-[10px]',
              isOutbound ? 'text-white/60 justify-end' : 'text-muted-foreground'
            )}
          >
            <ChannelIcon className="w-2.5 h-2.5" />
            <span>{channelLabel}</span>
            {showTime && <span>{time}</span>}
          </div>
        </div>
      </div>
    </div>
  )
})

/**
 * Modern image attachment with loading/error states
 * - Standalone: No wrapper, just image with rounded corners and shadow
 * - Inline: Edge-to-edge within bubble
 */
interface MessageImageProps {
  url: string
  isOutbound: boolean
  isStandalone?: boolean
}

function MessageImage({ url, isOutbound: _isOutbound, isStandalone = false }: MessageImageProps) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const blobUrlRef = useRef<string | null>(null)

  // For relative paths (proxy endpoints), fetch with auth and create blob URL
  // For absolute URLs, use directly
  const isRelativePath = url.startsWith('/')

  useEffect(() => {
    if (!isRelativePath) {
      // Absolute URL - use directly (e.g. already signed R2 URLs)
      setBlobUrl(url)
      return
    }

    let cancelled = false
    fetchMediaBlobUrl(url)
      .then((objectUrl) => {
        if (!cancelled) {
          blobUrlRef.current = objectUrl
          setBlobUrl(objectUrl)
        } else {
          URL.revokeObjectURL(objectUrl)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false)
          setError(true)
        }
      })

    return () => {
      cancelled = true
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = null
      }
    }
  }, [url, isRelativePath])

  // Error state
  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center bg-muted/50',
          isStandalone
            ? 'w-[200px] h-[140px] rounded-2xl'
            : 'w-full h-[140px]'
        )}
      >
        <ImageOff className="w-8 h-8 text-muted-foreground/50" />
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', isStandalone && 'rounded-2xl shadow-sm')}>
      {/* Loading skeleton */}
      {loading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-muted/30',
            isStandalone && 'rounded-2xl'
          )}
        >
          <div className="w-6 h-6 border-2 border-muted-foreground/30 border-t-muted-foreground rounded-full animate-spin" />
        </div>
      )}
      {blobUrl && (
        <img
          src={blobUrl}
          alt="Attachment"
          className={cn(
            'cursor-pointer transition-all duration-200 hover:brightness-95',
            isStandalone
              ? 'max-w-[280px] max-h-[280px] w-auto h-auto object-cover'
              : 'w-full max-h-[300px] object-cover',
            loading && 'opacity-0'
          )}
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false)
            setError(true)
          }}
          onClick={() => window.open(blobUrl, '_blank')}
        />
      )}
    </div>
  )
}

/**
 * Typing indicator for when staff is composing
 */
export function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" />
        </div>
      </div>
    </div>
  )
}
