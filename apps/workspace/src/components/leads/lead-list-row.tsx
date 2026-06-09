/**
 * Lead List Row - Single row in the leads table (memoized).
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Mail } from 'lucide-react'
import { cn } from '@ella/ui'
import { formatPhone, getInitials, getAvatarColor, formatSmartRelativeTime } from '../../lib/formatters'
import { LeadStatusBadge } from './lead-status-badge'
import { LeadSmsStatusIndicator } from './lead-sms-status-indicator'
import type { Lead } from '../../lib/api-client'

interface LeadListRowProps {
  lead: Lead
  selected: boolean
  onSelect: (id: string, selected: boolean) => void
  onRowClick: (lead: Lead) => void
  selectionDisabled?: boolean
  isLast: boolean
}

export const LeadListRow = memo(function LeadListRow({
  lead, selected, onSelect, onRowClick, selectionDisabled = false, isLast,
}: LeadListRowProps) {
  const { i18n } = useTranslation()
  const isConverted = lead.status === 'CONVERTED'
  const avatarColor = useMemo(
    () => getAvatarColor(`${lead.firstName} ${lead.lastName}`),
    [lead.firstName, lead.lastName],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onRowClick(lead)
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={() => onRowClick(lead)}
      onKeyDown={handleKeyDown}
      aria-label={`${lead.firstName} ${lead.lastName}`}
      className={cn(
        'h-16 cursor-pointer transition-all duration-150',
        'hover:bg-muted/40 hover:shadow-sm',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-inset',
        !isLast && 'border-b border-border/50',
        selected && 'bg-primary/5',
      )}
    >
      <td className="px-4 w-10">
        <label
          className={cn('relative flex items-center', isConverted || selectionDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={isConverted || selectionDisabled}
            onChange={(e) => onSelect(lead.id, e.target.checked)}
            className="peer sr-only"
            aria-label={`Select ${lead.firstName} ${lead.lastName}`}
          />
          <div className="h-4 w-4 rounded border-2 border-muted-foreground/40 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors flex items-center justify-center">
            {selected && (
              <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </div>
        </label>
      </td>

      <td className="px-4">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
            avatarColor.bg,
            avatarColor.text,
          )}>
            <span className="font-semibold text-sm">
              {getInitials(`${lead.firstName} ${lead.lastName}`)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">{lead.firstName} {lead.lastName}</p>
            {lead.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <Mail className="w-3 h-3 flex-shrink-0" aria-hidden="true" />
                <span className="truncate">{lead.email}</span>
              </p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 whitespace-nowrap">
        <span className="text-muted-foreground">{formatPhone(lead.phone)}</span>
      </td>

      <td className="px-4">
        <div className="flex min-w-32 flex-col gap-1.5">
          <LeadStatusBadge status={lead.status} variant="dot" />
          <LeadSmsStatusIndicator sms={lead.latestSms} compact />
        </div>
      </td>

      <td className="px-4 hidden sm:table-cell">
        <div className="flex flex-wrap gap-1">
          {lead.tags && lead.tags.length > 0 ? (
            lead.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
              >
                {tag}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </div>
      </td>

      <td className="px-4 hidden md:table-cell">
        <span className="text-muted-foreground">{lead.businessName || '—'}</span>
      </td>

      <td className="px-4 hidden lg:table-cell">
        <span className="text-muted-foreground whitespace-nowrap">
          {formatSmartRelativeTime(lead.createdAt, i18n.language)}
        </span>
      </td>
    </tr>
  )
})
