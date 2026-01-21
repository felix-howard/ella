/**
 * Chatbox Header - Header with client name and close controls
 * Facebook Messenger-style header with dark background for readability
 */

import { cn } from '@ella/ui'
import { X, Phone } from 'lucide-react'
import { getInitials, getAvatarColor, formatPhone } from '../../lib/formatters'

export interface ChatboxHeaderProps {
  clientName: string
  clientPhone?: string
  onClose: () => void
  onCall?: () => void
  className?: string
}

export function ChatboxHeader({
  clientName,
  clientPhone,
  onClose,
  onCall,
  className,
}: ChatboxHeaderProps) {
  const avatarColor = getAvatarColor(clientName)

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-slate-800 dark:bg-slate-900',
        'rounded-t-xl',
        className
      )}
    >
      {/* Client info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', avatarColor.bg)}>
          <span className={cn('font-semibold text-sm', avatarColor.text)}>
            {getInitials(clientName)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-medium text-sm truncate">
            {clientName}
          </h3>
          {clientPhone && (
            <p className="text-slate-400 text-xs truncate">
              {formatPhone(clientPhone)}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Call button */}
        {onCall && (
          <button
            onClick={onCall}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
            aria-label="Gọi điện cho khách hàng"
            title="Gọi điện"
          >
            <Phone className="w-4 h-4 text-white" />
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Đóng hộp chat"
          title="Đóng"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  )
}
