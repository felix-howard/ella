/**
 * Message Bubble - Modern chat UI component
 * Inspired by WhatsApp, iMessage, Telegram for clean visual design
 */

import { memo, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { Phone, Globe, Bot, ImageOff, PhoneCall, PhoneOff, PhoneMissed, Check, CheckCheck, Clock, AlertCircle, XCircle } from 'lucide-react'
import { sanitizeText, linkifyText, formatRelativeTime, getInitials, getAvatarColor } from '../../lib/formatters'
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

/**
 * Parse twilioStatus string which may contain error details
 * Format: "status" or "status:errorCode:errorMessage"
 */
function parseTwilioStatus(twilioStatus: string | null | undefined): {
  status: string
  errorCode?: string
  errorMessage?: string
} {
  if (!twilioStatus) return { status: '' }

  // Check for ERROR: prefix (set by send route on immediate failure)
  if (twilioStatus.startsWith('ERROR: ')) {
    const errorPart = twilioStatus.substring(7)
    // Parse TWILIO_ERROR_21612:message format
    const match = errorPart.match(/^TWILIO_ERROR_(\d+):(.+)$/)
    if (match) {
      return { status: 'failed', errorCode: match[1], errorMessage: match[2] }
    }
    return { status: 'failed', errorCode: undefined, errorMessage: errorPart }
  }

  // Parse "status:errorCode:errorMessage" format from webhook
  const parts = twilioStatus.split(':')
  if (parts.length >= 3) {
    return { status: parts[0], errorCode: parts[1], errorMessage: parts.slice(2).join(':') }
  }

  return { status: twilioStatus }
}

/** SMS delivery status config */
const SMS_STATUS_CONFIG: Record<string, { icon: React.ReactNode; labelKey: string; color: string }> = {
  queued: { icon: <Clock className="w-3 h-3" />, labelKey: 'messages.smsStatus.queued', color: 'text-muted-foreground/60' },
  sent: { icon: <Check className="w-3 h-3" />, labelKey: 'messages.smsStatus.sent', color: 'text-muted-foreground/60' },
  delivered: { icon: <CheckCheck className="w-3 h-3" />, labelKey: 'messages.smsStatus.delivered', color: 'text-blue-500' },
  undelivered: { icon: <AlertCircle className="w-3 h-3" />, labelKey: 'messages.smsStatus.undelivered', color: 'text-orange-500' },
  failed: { icon: <XCircle className="w-3 h-3" />, labelKey: 'messages.smsStatus.failed', color: 'text-destructive' },
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

  // Parse SMS delivery status for outbound SMS messages
  const smsStatus = isOutbound && message.channel === 'SMS'
    ? parseTwilioStatus(message.twilioStatus)
    : null
  const smsStatusConfig = smsStatus?.status ? SMS_STATUS_CONFIG[smsStatus.status] : null
  const isError = smsStatus?.status === 'failed' || smsStatus?.status === 'undelivered'

  // System messages have centered, muted style
  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/30 text-[11px] text-muted-foreground/70">
          <Bot className="w-3 h-3" />
          <span>{safeContent}</span>
          {showTime && <span className="ml-1 opacity-60">• {time}</span>}
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
            isOutbound ? 'bg-primary/10' : 'bg-card shadow-[0_1px_3px_-1px_rgba(0,0,0,0.08)]'
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

  // Image-only message
  if (isImageOnly) {
    if (isOutbound) {
      return (
        <div className="flex flex-col w-full items-end">
          <div className="flex items-end gap-2 max-w-[280px]">
            <div className="flex flex-col gap-1.5">
              {message.attachmentUrls!.map((url, index) => (
                <MessageImage key={index} url={url} isOutbound isStandalone />
              ))}
            </div>
            <StaffAvatar sentBy={message.sentBy} />
          </div>
          <SenderMeta sentBy={message.sentBy} showTime={showTime} createdAt={message.createdAt} />
          <SmsStatus smsStatusConfig={smsStatusConfig} smsStatus={smsStatus} isError={isError} t={t} />
        </div>
      )
    }
    return (
      <div className="flex flex-col w-full items-start">
        <div className="flex flex-col gap-1.5 max-w-[280px]">
          {message.attachmentUrls!.map((url, index) => (
            <MessageImage key={index} url={url} isOutbound={false} isStandalone />
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1 mt-1">
          <ChannelIcon className="w-3 h-3" />
          <span>{channelLabel}</span>
          {showTime && <span>{time}</span>}
        </div>
      </div>
    )
  }

  // Outbound text message — redesigned layout
  if (isOutbound) {
    return (
      <div className="flex flex-col w-full items-end">
        <div className="flex items-end gap-2 max-w-[75%]">
          {/* Message bubble - light green, only text */}
          <div className="rounded-[20px] rounded-br-[6px] bg-emerald-50 overflow-hidden">
            {hasAttachments && (
              <div className="flex flex-col">
                {message.attachmentUrls!.map((url, index) => (
                  <MessageImage key={index} url={url} isOutbound isStandalone={false} />
                ))}
              </div>
            )}
            <div className="px-3.5 py-2">
              {hasText && (
                <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words text-gray-700">
                  <LinkifiedText text={safeContent} isOutbound />
                </p>
              )}
            </div>
          </div>
          {/* Staff avatar */}
          <StaffAvatar sentBy={message.sentBy} />
        </div>

        {/* Metadata below bubble */}
        <SenderMeta sentBy={message.sentBy} showTime={showTime} createdAt={message.createdAt} />

        {/* SMS delivery status */}
        <SmsStatus smsStatusConfig={smsStatusConfig} smsStatus={smsStatus} isError={isError} t={t} />
      </div>
    )
  }

  // Inbound text message — keep existing design
  return (
    <div className="flex flex-col w-full items-start">
      <div
        className={cn(
          'max-w-[75%] overflow-hidden',
          'rounded-[20px] rounded-bl-[6px]',
          'bg-card text-foreground shadow-[0_1px_3px_-1px_rgba(0,0,0,0.08)]'
        )}
      >
        {hasAttachments && (
          <div className="flex flex-col">
            {message.attachmentUrls!.map((url, index) => (
              <MessageImage key={index} url={url} isOutbound={false} isStandalone={false} />
            ))}
          </div>
        )}
        <div className="px-3.5 py-2">
          {hasText && (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
              <LinkifiedText text={safeContent} isOutbound={false} />
            </p>
          )}
          <div className="flex items-center gap-1.5 mt-1 text-[10px] text-muted-foreground/60">
            <ChannelIcon className="w-2.5 h-2.5" />
            <span>{channelLabel}</span>
            {showTime && <span>{time}</span>}
          </div>
        </div>
      </div>
    </div>
  )
})

/** Staff avatar shown to the right of outbound messages */
function StaffAvatar({ sentBy }: { sentBy?: Message['sentBy'] }) {
  if (!sentBy) return <div className="w-7 flex-shrink-0" /> // spacer for alignment
  if (sentBy.avatarUrl) {
    return (
      <img
        src={sentBy.avatarUrl}
        alt={sentBy.name}
        className="w-7 h-7 rounded-full object-cover flex-shrink-0"
      />
    )
  }
  const colors = getAvatarColor(sentBy.name)
  return (
    <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0', colors.bg, colors.text)}>
      {getInitials(sentBy.name)}
    </div>
  )
}

/** Sender name + relative time below outbound bubble */
function SenderMeta({ sentBy, showTime, createdAt }: { sentBy?: Message['sentBy']; showTime: boolean; createdAt: string }) {
  if (!sentBy && !showTime) return null
  return (
    <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground pr-9">
      {sentBy && <span className="font-medium text-foreground/70">{sentBy.name}</span>}
      {showTime && <span>{formatRelativeTime(createdAt)}</span>}
    </div>
  )
}

/** SMS delivery status below metadata */
function SmsStatus({ smsStatusConfig, smsStatus, isError, t }: {
  smsStatusConfig: (typeof SMS_STATUS_CONFIG)[string] | null
  smsStatus: { status: string; errorCode?: string; errorMessage?: string } | null
  isError: boolean
  t: (key: string) => string
}) {
  if (!smsStatusConfig) return null
  return (
    <div className={cn('flex items-center gap-1 text-[11px] pr-9 flex-wrap', isError ? 'text-destructive' : smsStatusConfig.color)}>
      {isError ? (
        <>
          <span>Sending failed</span>
          {smsStatus?.errorMessage && <ErrorDetails errorMessage={smsStatus.errorMessage} />}
        </>
      ) : (
        <>
          {smsStatusConfig.icon}
          <span>{t(smsStatusConfig.labelKey)}</span>
        </>
      )}
    </div>
  )
}

/** Expandable error details for failed messages */
function ErrorDetails({ errorMessage }: { errorMessage: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(!open)} className="text-destructive underline text-[11px]">
        (Details)
      </button>
      {open && <div className="text-[10px] text-destructive/80 mt-0.5 w-full">{errorMessage}</div>}
    </>
  )
}

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
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
 * Renders text with clickable links that open in new tab
 */
function LinkifiedText({ text, isOutbound: _isOutbound }: { text: string; isOutbound: boolean }) {
  const parts = linkifyText(text)
  const hasLinks = parts.some(p => p.type === 'link')

  if (!hasLinks) return <>{text}</>

  return (
    <>
      {parts.map((part, i) =>
        part.type === 'link' ? (
          <a
            key={i}
            href={part.value}
            target="_blank"
            rel="noopener noreferrer"
            className="underline break-all text-primary hover:text-primary/80"
          >
            {part.value}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
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
