/**
 * Chatbox Button - Floating action button with unread message badge
 * Facebook Messenger-style floating button at bottom-right corner
 */

import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import { MessageCircle } from 'lucide-react'

export interface ChatboxButtonProps {
  unreadCount: number
  isOpen: boolean
  onClick: () => void
  className?: string
}

export function ChatboxButton({ unreadCount, isOpen, onClick, className }: ChatboxButtonProps) {
  const { t } = useTranslation()

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center',
        'bg-gradient-to-br from-emerald-400 to-primary text-white',
        'shadow-lg shadow-primary/40 hover:shadow-xl hover:shadow-primary/50',
        'ring-4 ring-white/80 dark:ring-background',
        'hover:from-emerald-500 hover:to-primary-dark',
        'transition-all duration-200 hover:scale-110',
        'focus:outline-none focus:ring-offset-2 focus:ring-primary/60',
        isOpen && 'rotate-0',
        className
      )}
      aria-label={isOpen ? t('chat.closeChat') : t('chat.openChat')}
      title={isOpen ? t('chat.closeChat') : t('chat.openChat')}
    >
      <MessageCircle className="w-6 h-6 drop-shadow-sm" />

      {/* Unread badge */}
      {!isOpen && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 text-xs font-bold bg-destructive text-white rounded-full animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
