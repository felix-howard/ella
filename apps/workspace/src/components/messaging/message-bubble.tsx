/**
 * Message Bubble - Individual message display component
 * Shows message content with direction-based styling and channel indicator
 */

import { memo, useState } from 'react'
import { cn } from '@ella/ui'
import { Phone, Globe, Bot, ImageOff } from 'lucide-react'
import { sanitizeText } from '../../lib/formatters'
import type { Message } from '../../lib/api-client'

export interface MessageBubbleProps {
  message: Message
  showTime?: boolean
}

// Channel icons and labels
const CHANNEL_INFO = {
  SMS: { icon: Phone, label: 'SMS', color: 'text-primary' },
  PORTAL: { icon: Globe, label: 'Portal', color: 'text-accent' },
  SYSTEM: { icon: Bot, label: 'Hệ thống', color: 'text-muted-foreground' },
} as const

export const MessageBubble = memo(function MessageBubble({ message, showTime = true }: MessageBubbleProps) {
  const isOutbound = message.direction === 'OUTBOUND'
  const isSystem = message.channel === 'SYSTEM'
  const channelInfo = CHANNEL_INFO[message.channel]
  const ChannelIcon = channelInfo.icon

  // Format time
  const time = new Date(message.createdAt).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // Sanitize content to prevent XSS
  const safeContent = sanitizeText(message.content)

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

  return (
    <div
      className={cn(
        'flex w-full',
        isOutbound ? 'justify-end' : 'justify-start'
      )}
    >
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5',
          isOutbound
            ? 'bg-primary text-white rounded-br-md'
            : 'bg-card border border-border text-foreground rounded-bl-md'
        )}
      >
        {/* Message content - sanitized */}
        {safeContent && (
          <p className="text-sm whitespace-pre-wrap break-words">{safeContent}</p>
        )}

        {/* Attachment images */}
        {message.attachmentUrls && message.attachmentUrls.length > 0 && (
          <div className={cn('flex flex-wrap gap-2', safeContent && 'mt-2')}>
            {message.attachmentUrls.map((url, index) => (
              <MessageAttachment
                key={index}
                url={url}
                isOutbound={isOutbound}
              />
            ))}
          </div>
        )}

        {/* Footer with channel and time */}
        <div
          className={cn(
            'flex items-center gap-2 mt-1.5 text-[10px]',
            isOutbound ? 'text-white/70 justify-end' : 'text-muted-foreground'
          )}
        >
          <div className="flex items-center gap-1">
            <ChannelIcon className="w-3 h-3" />
            <span>{channelInfo.label}</span>
          </div>
          {showTime && <span>{time}</span>}
        </div>
      </div>
    </div>
  )
})

/**
 * Message attachment image with loading and error states
 */
function MessageAttachment({ url, isOutbound }: { url: string; isOutbound: boolean }) {
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  if (error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center w-[150px] h-[100px] rounded',
          isOutbound ? 'bg-white/10' : 'bg-muted'
        )}
      >
        <ImageOff className="w-6 h-6 text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="relative">
      {loading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded',
            isOutbound ? 'bg-white/10' : 'bg-muted'
          )}
        >
          <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin opacity-50" />
        </div>
      )}
      <img
        src={url}
        alt="Attachment"
        className={cn(
          'max-w-[200px] max-h-[200px] rounded object-cover cursor-pointer hover:opacity-90 transition-opacity',
          loading && 'invisible'
        )}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false)
          setError(true)
        }}
        onClick={() => window.open(url, '_blank')}
      />
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
