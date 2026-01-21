/**
 * Chatbox Button - Floating action button with unread message badge
 * Facebook Messenger-style floating button at bottom-right corner
 */

import { cn } from '@ella/ui'
import { MessageCircle } from 'lucide-react'

export interface ChatboxButtonProps {
  unreadCount: number
  isOpen: boolean
  onClick: () => void
  className?: string
}

export function ChatboxButton({ unreadCount, isOpen, onClick, className }: ChatboxButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center',
        'bg-primary text-white shadow-lg hover:bg-primary-dark',
        'transition-all duration-200 hover:scale-105',
        'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2',
        isOpen && 'rotate-0',
        className
      )}
      aria-label={isOpen ? 'Đóng hộp chat' : 'Mở hộp chat'}
      title={isOpen ? 'Đóng hộp chat' : 'Mở hộp chat'}
    >
      <MessageCircle className="w-6 h-6" />

      {/* Unread badge */}
      {!isOpen && unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[22px] h-[22px] flex items-center justify-center px-1.5 text-xs font-bold bg-destructive text-white rounded-full animate-pulse">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  )
}
