/**
 * Chatbox Header - generic header for the FloatingChatbox.
 * Accepts a title/subtitle pair so it can render for either a client case or a lead.
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { X, Phone } from 'lucide-react'
import { getInitials, getAvatarColor, formatPhone, maskPhone } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'

export interface ChatboxHeaderProps {
  /** Primary line (e.g., client or lead full name). */
  title: string
  /** Optional phone displayed below the title (masked for non-admins). */
  phone?: string
  /** Optional free-text subtitle — takes precedence over phone if provided. */
  subtitle?: string
  onClose: () => void
  /** When undefined, the call button is hidden. */
  onCall?: () => void
  className?: string
}

export function ChatboxHeader({
  title,
  phone,
  subtitle,
  onClose,
  onCall,
  className,
}: ChatboxHeaderProps) {
  const { t } = useTranslation()
  const { canViewPhone } = useOrgRole()
  const avatarColor = getAvatarColor(title)

  const displaySubtitle =
    subtitle ?? (phone ? (canViewPhone ? formatPhone(phone) : maskPhone(phone)) : undefined)

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-3',
        'bg-card border-b border-border',
        'rounded-t-xl',
        className
      )}
    >
      {/* Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ring-2 ring-background',
          avatarColor.bg
        )}>
          <span className={cn('font-medium text-sm', avatarColor.text)}>
            {getInitials(title)}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground truncate tracking-tight">
            {title}
          </h3>
          {displaySubtitle && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">
              {displaySubtitle}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
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
