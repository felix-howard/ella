/**
 * Action Card Component - Displays a single action item with priority styling
 * Used in the Action Queue page to show pending tasks for staff
 */

import { Link } from '@tanstack/react-router'
import {
  CheckCircle,
  AlertTriangle,
  Eye,
  FileText,
  Bell,
  MessageCircle,
  Clock,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@ella/ui'
import {
  ACTION_TYPE_LABELS,
  ACTION_TYPE_COLORS,
  ACTION_PRIORITY_LABELS,
  ACTION_PRIORITY_COLORS,
  UI_TEXT,
} from '../../lib/constants'
import type { Action, ActionType } from '../../lib/api-client'

interface ActionCardProps {
  action: Action
  onComplete?: (id: string) => void
}

// Direct icon mapping for action types - avoids function call during render
const ACTION_TYPE_ICONS: Record<ActionType, LucideIcon> = {
  VERIFY_DOCS: CheckCircle,
  AI_FAILED: AlertTriangle,
  BLURRY_DETECTED: Eye,
  READY_FOR_ENTRY: FileText,
  REMINDER_DUE: Bell,
  CLIENT_REPLIED: MessageCircle,
}

export function ActionCard({ action, onComplete }: ActionCardProps) {
  const typeColors = ACTION_TYPE_COLORS[action.type]
  const priorityColors = ACTION_PRIORITY_COLORS[action.priority]
  const Icon = ACTION_TYPE_ICONS[action.type] || CheckCircle
  const { actions: actionsText } = UI_TEXT

  // Format relative time
  const createdAt = new Date(action.createdAt)
  const relativeTime = getRelativeTime(createdAt)

  // Generate link based on action type
  const isClientReplied = action.type === 'CLIENT_REPLIED'
  const caseLink = isClientReplied
    ? `/messages/${action.caseId}`
    : `/cases/${action.caseId}/verify`

  // Get message preview from metadata for CLIENT_REPLIED actions
  const messagePreview = isClientReplied && action.metadata?.preview
    ? String(action.metadata.preview)
    : null

  return (
    <div
      className={cn(
        'bg-card rounded-xl border p-4 hover:shadow-md transition-shadow',
        action.priority === 'URGENT' && 'border-error',
        action.priority === 'HIGH' && 'border-accent',
        isClientReplied && 'border-l-4 border-l-success',
        !action.priority && !isClientReplied && 'border-border'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div
          className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
            isClientReplied ? 'bg-success/10' : (typeColors?.bg || 'bg-muted')
          )}
        >
          <Icon className={cn('w-5 h-5', isClientReplied ? 'text-success' : (typeColors?.text || 'text-muted-foreground'))} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {/* Priority Badge */}
            <span
              className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                isClientReplied ? 'bg-success/10 text-success' : (priorityColors?.bg || 'bg-muted'),
                !isClientReplied && (priorityColors?.text || 'text-muted-foreground')
              )}
            >
              {isClientReplied ? 'Mới' : (ACTION_PRIORITY_LABELS[action.priority] || action.priority)}
            </span>
            {/* Type Label */}
            <span className="text-xs text-muted-foreground">
              {ACTION_TYPE_LABELS[action.type] || action.type}
            </span>
          </div>

          {/* Title */}
          <h3 className="font-medium text-foreground truncate">{action.title}</h3>

          {/* Client name if available */}
          {action.taxCase?.client && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {action.taxCase.client.name}
            </p>
          )}

          {/* Message preview for CLIENT_REPLIED */}
          {messagePreview && (
            <p className="text-sm bg-muted/50 rounded p-2 mt-2 italic text-muted-foreground line-clamp-2">
              &ldquo;{messagePreview}&rdquo;
            </p>
          )}

          {/* Description if available (and not CLIENT_REPLIED with preview) */}
          {action.description && !messagePreview && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {action.description}
            </p>
          )}

          {/* Footer with time and actions */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{relativeTime}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Complete button */}
              {onComplete && !action.isCompleted && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    onComplete(action.id)
                  }}
                  className="text-xs text-primary hover:text-primary-dark font-medium px-2 py-1 rounded hover:bg-primary-light transition-colors"
                  aria-label={`${actionsText.complete}: ${action.title}`}
                >
                  {actionsText.complete}
                </button>
              )}

              {/* View link - different label for CLIENT_REPLIED */}
              <Link
                to={caseLink as '/'}
                className={cn(
                  'flex items-center gap-1 text-xs font-medium px-2 py-1 rounded transition-colors',
                  isClientReplied
                    ? 'text-success hover:text-success/80 hover:bg-success/10'
                    : 'text-muted-foreground hover:text-primary'
                )}
                aria-label={isClientReplied
                  ? `Xem hội thoại: ${action.title}`
                  : `${actionsText.viewDetail}: ${action.title}`
                }
              >
                {isClientReplied && <MessageCircle className="w-3 h-3" aria-hidden="true" />}
                <span>{isClientReplied ? 'Xem hội thoại' : actionsText.viewDetail}</span>
                <ChevronRight className="w-3 h-3" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Compact variant for sidebar or smaller displays
export function ActionCardCompact({ action, onComplete }: ActionCardProps) {
  const typeColors = ACTION_TYPE_COLORS[action.type]
  const Icon = ACTION_TYPE_ICONS[action.type] || CheckCircle
  const { actions: actionsText } = UI_TEXT

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
          typeColors?.bg || 'bg-muted'
        )}
        aria-hidden="true"
      >
        <Icon className={cn('w-4 h-4', typeColors?.text || 'text-muted-foreground')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{action.title}</p>
        {action.taxCase?.client && (
          <p className="text-xs text-muted-foreground truncate">
            {action.taxCase.client.name}
          </p>
        )}
      </div>
      {onComplete && !action.isCompleted && (
        <button
          onClick={() => onComplete(action.id)}
          className="text-primary hover:text-primary-dark p-1"
          aria-label={`${actionsText.complete}: ${action.title}`}
        >
          <CheckCircle className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

// Helper function to get relative time in Vietnamese
function getRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'Vừa xong'
  if (diffMinutes < 60) return `${diffMinutes} phút trước`
  if (diffHours < 24) return `${diffHours} giờ trước`
  if (diffDays < 7) return `${diffDays} ngày trước`

  return date.toLocaleDateString('vi-VN', {
    day: 'numeric',
    month: 'short',
  })
}
