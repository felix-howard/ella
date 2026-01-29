/**
 * Version History - Timeline of Schedule C submissions and changes
 */
import { useState, useMemo } from 'react'
import { History, ChevronDown, ChevronUp } from 'lucide-react'
import type { VersionHistoryEntry } from '../../../../lib/api-client'
import { formatDateTime } from './format-utils'

interface VersionHistoryProps {
  history: VersionHistoryEntry[]
}

export function VersionHistory({ history }: VersionHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  // Memoize sorted history to avoid sorting on every render
  const sortedHistory = useMemo(() =>
    [...history].sort((a, b) => b.version - a.version),
    [history]
  )

  // Show only first 3 unless expanded
  const displayedHistory = isExpanded ? sortedHistory : sortedHistory.slice(0, 3)
  const hasMore = sortedHistory.length > 3

  if (sortedHistory.length === 0) {
    return null
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-foreground uppercase tracking-wide mb-3 pb-2 border-b border-border flex items-center gap-2">
        <History className="w-4 h-4" />
        Lịch sử phiên bản
      </h3>

      <div className="space-y-3">
        {displayedHistory.map((entry) => (
          <div
            key={entry.version}
            className="flex items-start gap-2 sm:gap-3 text-sm"
          >
            {/* Version badge */}
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-medium flex-shrink-0 mt-0.5">
              v{entry.version}
            </span>

            <div className="flex-1 min-w-0">
              {/* Timestamp */}
              <p className="text-xs text-muted-foreground truncate">
                {formatDateTime(entry.submittedAt, 'DATETIME_FULL')}
              </p>

              {/* Changes */}
              <p className="text-foreground break-words">
                {entry.changes.length > 0
                  ? entry.changes.join(', ')
                  : 'Tạo mới'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Show more/less toggle */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-3"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-3 h-3" />
              Thu gọn
            </>
          ) : (
            <>
              <ChevronDown className="w-3 h-3" />
              Xem thêm ({sortedHistory.length - 3})
            </>
          )}
        </button>
      )}
    </div>
  )
}
