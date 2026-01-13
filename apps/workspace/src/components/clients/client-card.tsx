/**
 * Client Card Component - Displays client info for Kanban board
 * Shows client name, phone, case status, and document counts
 */

import { Link } from '@tanstack/react-router'
import { Phone, ChevronRight } from 'lucide-react'
import { cn } from '@ella/ui'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS, UI_TEXT } from '../../lib/constants'
import { formatPhone, getInitials } from '../../lib/formatters'
import type { Client, TaxCaseStatus } from '../../lib/api-client'

interface ClientCardProps {
  client: Client
  onClick?: () => void
}

export function ClientCard({ client, onClick }: ClientCardProps) {
  // Get latest case status (if any)
  const latestCase = client.taxCases?.[0]
  const caseStatus = latestCase?.status as TaxCaseStatus | undefined
  const statusColors = caseStatus ? CASE_STATUS_COLORS[caseStatus] : null
  const statusLabel = caseStatus ? CASE_STATUS_LABELS[caseStatus] : null

  const cardContent = (
    <div
      className={cn(
        'bg-card rounded-xl border border-border p-4 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer',
        onClick && 'active:scale-[0.98]'
      )}
      onClick={onClick}
    >
      {/* Header with name and status */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{client.name}</h3>
          <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
            <Phone className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{formatPhone(client.phone)}</span>
          </div>
        </div>

        {/* Status badge */}
        {statusLabel && statusColors && (
          <span
            className={cn(
              'text-xs font-medium px-2 py-1 rounded-full whitespace-nowrap',
              statusColors.bg,
              statusColors.text
            )}
          >
            {statusLabel}
          </span>
        )}
      </div>

      {/* Tax year and docs info */}
      {latestCase && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">
            {UI_TEXT.form.taxYear} {latestCase.taxYear}
          </span>
        </div>
      )}

      {/* Footer with view detail */}
      <div className="flex items-center justify-end mt-3 pt-3 border-t border-border">
        <span className="flex items-center gap-1 text-xs text-primary hover:text-primary-dark transition-colors">
          <span>{UI_TEXT.actions.viewDetail}</span>
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </span>
      </div>
    </div>
  )

  // Wrap in Link if no custom onClick handler
  if (!onClick) {
    return (
      <Link
        to="/clients/$clientId"
        params={{ clientId: client.id }}
        className="block"
      >
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

/**
 * Compact variant for list view or smaller displays
 */
export function ClientCardCompact({ client, onClick }: ClientCardProps) {
  const latestCase = client.taxCases?.[0]
  const caseStatus = latestCase?.status as TaxCaseStatus | undefined
  const statusColors = caseStatus ? CASE_STATUS_COLORS[caseStatus] : null
  const statusLabel = caseStatus ? CASE_STATUS_LABELS[caseStatus] : null

  const content = (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Avatar/Initial */}
      <div className="w-10 h-10 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
        <span className="text-primary font-semibold text-sm">
          {getInitials(client.name)}
        </span>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-foreground truncate">{client.name}</p>
        <p className="text-sm text-muted-foreground truncate">{formatPhone(client.phone)}</p>
      </div>

      {/* Status */}
      {statusLabel && statusColors && (
        <span
          className={cn(
            'text-xs font-medium px-2 py-1 rounded-full',
            statusColors.bg,
            statusColors.text
          )}
        >
          {statusLabel}
        </span>
      )}

      <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
    </div>
  )

  if (!onClick) {
    return (
      <Link
        to="/clients/$clientId"
        params={{ clientId: client.id }}
        className="block"
      >
        {content}
      </Link>
    )
  }

  return content
}

/**
 * Skeleton loader for client card
 */
export function ClientCardSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border p-4 animate-pulse">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-4 w-24 bg-muted rounded mt-2" />
        </div>
        <div className="h-6 w-20 bg-muted rounded-full" />
      </div>
      <div className="h-4 w-16 bg-muted rounded" />
      <div className="flex justify-end mt-3 pt-3 border-t border-border">
        <div className="h-4 w-20 bg-muted rounded" />
      </div>
    </div>
  )
}

