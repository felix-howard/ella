/**
 * Doc Tabs Component - Tab navigation for switching between documents in data entry mode
 * Shows verified documents with status indicators
 */

import { cn } from '@ella/ui'
import { FileText, Check, AlertCircle, Clock } from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import type { DigitalDoc } from '../../lib/api-client'

type DocStatus = 'EXTRACTED' | 'VERIFIED' | 'PARTIAL' | 'FAILED'

const STATUS_CONFIG: Record<DocStatus, { icon: typeof Check; color: string; bgColor: string }> = {
  EXTRACTED: { icon: Clock, color: 'text-primary', bgColor: 'bg-primary-light' },
  VERIFIED: { icon: Check, color: 'text-success', bgColor: 'bg-success/10' },
  PARTIAL: { icon: AlertCircle, color: 'text-warning', bgColor: 'bg-warning-light' },
  FAILED: { icon: AlertCircle, color: 'text-error', bgColor: 'bg-error-light' },
}

export interface DocTabsProps {
  docs: DigitalDoc[]
  activeDocId: string | null
  onDocSelect: (doc: DigitalDoc) => void
  /** Show compact tabs for narrow layouts */
  compact?: boolean
  /** Show copy progress indicator */
  copiedFields?: Record<string, Set<string>>
}

export function DocTabs({
  docs,
  activeDocId,
  onDocSelect,
  compact = false,
  copiedFields = {},
}: DocTabsProps) {
  if (!docs.length) {
    return (
      <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
        <FileText className="w-4 h-4 mr-2" />
        Chưa có tài liệu nào được trích xuất
      </div>
    )
  }

  return (
    <div className={cn('flex gap-2', compact ? 'flex-col' : 'flex-wrap')}>
      {docs.map((doc) => {
        const isActive = doc.id === activeDocId
        const status = doc.status as DocStatus
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.EXTRACTED
        const StatusIcon = config.icon
        const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

        // Calculate copy progress for this doc
        const totalFields = Object.keys(doc.extractedData || {}).length
        const copiedCount = copiedFields[doc.id]?.size || 0
        const progress = totalFields > 0 ? (copiedCount / totalFields) * 100 : 0

        return (
          <button
            key={doc.id}
            onClick={() => onDocSelect(doc)}
            className={cn(
              'relative flex items-center gap-2 rounded-lg border transition-all',
              compact ? 'p-2 w-full justify-start' : 'px-4 py-2.5',
              isActive
                ? 'border-primary bg-primary-light shadow-sm'
                : 'border-border bg-card hover:bg-muted/50 hover:border-primary/30'
            )}
          >
            {/* Doc Type Icon with Status */}
            <div className={cn('relative p-1.5 rounded-md', config.bgColor)}>
              <FileText className={cn('w-4 h-4', config.color)} />
              <StatusIcon
                className={cn(
                  'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-card',
                  config.color
                )}
              />
            </div>

            {/* Doc Info */}
            <div className={cn('text-left', compact && 'flex-1')}>
              <p
                className={cn(
                  'text-sm font-medium truncate',
                  isActive ? 'text-primary' : 'text-foreground'
                )}
              >
                {docLabel}
              </p>
              {!compact && (
                <p className="text-xs text-muted-foreground">
                  {totalFields} trường
                  {copiedCount > 0 && ` • ${copiedCount} đã copy`}
                </p>
              )}
            </div>

            {/* Progress Bar (only if started) */}
            {progress > 0 && progress < 100 && (
              <div
                className={cn(
                  'absolute bottom-0 left-0 h-0.5 bg-primary rounded-b-lg transition-all',
                  compact ? 'w-full' : ''
                )}
                style={{ width: compact ? `${progress}%` : undefined }}
              />
            )}

            {/* Complete Badge */}
            {progress === 100 && (
              <div className="p-1 rounded-full bg-success/10">
                <Check className="w-3 h-3 text-success" />
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Vertical doc tabs for sidebar layout
 */
export interface DocTabsSidebarProps extends DocTabsProps {
  className?: string
}

export function DocTabsSidebar({
  docs,
  activeDocId,
  onDocSelect,
  copiedFields = {},
  className,
}: DocTabsSidebarProps) {
  if (!docs.length) {
    return (
      <div className={cn('p-4 text-center text-sm text-muted-foreground', className)}>
        <FileText className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
        <p>Chưa có tài liệu</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-1', className)}>
      {docs.map((doc, index) => {
        const isActive = doc.id === activeDocId
        const status = doc.status as DocStatus
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.EXTRACTED
        const StatusIcon = config.icon
        const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

        const totalFields = Object.keys(doc.extractedData || {}).length
        const copiedCount = copiedFields[doc.id]?.size || 0
        const isComplete = copiedCount === totalFields && totalFields > 0

        return (
          <button
            key={doc.id}
            onClick={() => onDocSelect(doc)}
            className={cn(
              'w-full flex items-center gap-3 p-3 rounded-lg border transition-all',
              isActive
                ? 'border-primary bg-primary-light'
                : 'border-transparent hover:bg-muted/50'
            )}
          >
            {/* Number Badge */}
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center text-sm font-medium',
                isComplete
                  ? 'bg-success text-white'
                  : isActive
                    ? 'bg-primary text-white'
                    : 'bg-muted text-muted-foreground'
              )}
            >
              {isComplete ? <Check className="w-4 h-4" /> : index + 1}
            </div>

            {/* Doc Info */}
            <div className="flex-1 text-left min-w-0">
              <p
                className={cn(
                  'text-sm font-medium truncate',
                  isActive ? 'text-primary' : 'text-foreground'
                )}
              >
                {docLabel}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StatusIcon className={cn('w-3 h-3', config.color)} />
                <span>{totalFields} trường</span>
                {copiedCount > 0 && <span>• {copiedCount}/{totalFields}</span>}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}
