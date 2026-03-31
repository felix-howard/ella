/**
 * Chatbox Header - Consistent with /messages conversation header
 * Light background with avatar, client info, green Call button, and close
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { X, Phone } from 'lucide-react'
import { getInitials, getAvatarColor, formatPhone, maskPhone } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'

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
  const { t } = useTranslation()
  const { isAdmin } = useOrgRole()
  const avatarColor = getAvatarColor(clientName)

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-card border-b border-border',
        'rounded-t-xl',
        className
      )}
    >
      {/* Client info */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-background',
          avatarColor.bg
        )}>
          <span className={cn('font-medium text-sm', avatarColor.text)}>
            {getInitials(clientName)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate tracking-tight">
            {clientName}
          </h3>
          {clientPhone && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {isAdmin ? formatPhone(clientPhone) : maskPhone(clientPhone)}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {/* Call button - green with text, matching /messages page */}
        {onCall && (
          <button
            onClick={onCall}
            className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-all duration-200 text-green-600 dark:text-green-400 hover:bg-green-500/20 active:bg-green-500/30"
            aria-label={t('chat.callClient')}
            title={t('chat.call')}
          >
            <Phone className="w-4 h-4" />
            <span>{t('chat.call')}</span>
          </button>
        )}

        {/* Close */}
        <button
          onClick={onClose}
          className="p-2 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          aria-label={t('chat.closeChat')}
          title={t('chat.close')}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
