/**
 * Chatbox Header - Header with client name and minimize/close controls
 * Facebook Messenger-style header with gradient background
 */

import { cn } from '@ella/ui'
import { Minus, X, Phone } from 'lucide-react'

export interface ChatboxHeaderProps {
  clientName: string
  clientPhone?: string
  onMinimize: () => void
  onClose: () => void
  onCall?: () => void
  className?: string
}

export function ChatboxHeader({
  clientName,
  clientPhone,
  onMinimize,
  onClose,
  onCall,
  className,
}: ChatboxHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-gradient-to-r from-primary to-primary-dark',
        'rounded-t-xl',
        className
      )}
    >
      {/* Client info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-white font-semibold text-sm">
            {clientName.charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-white font-medium text-sm truncate">
            {clientName}
          </h3>
          {clientPhone && (
            <p className="text-white/70 text-xs truncate">
              {clientPhone}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Call button - optional */}
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

        {/* Minimize */}
        <button
          onClick={onMinimize}
          className="p-2 rounded-full hover:bg-white/10 transition-colors"
          aria-label="Thu nhỏ hộp chat"
          title="Thu nhỏ"
        >
          <Minus className="w-4 h-4 text-white" />
        </button>

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
