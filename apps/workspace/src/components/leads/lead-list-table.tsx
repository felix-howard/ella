/**
 * Lead List Table - Table view of leads matching client list table design
 */
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Mail, ArrowRight, Users } from 'lucide-react'
import { cn } from '@ella/ui'
import { formatPhone, getInitials, getAvatarColor, formatShortRelativeTime } from '../../lib/formatters'
import { LeadStatusBadge } from './lead-status-badge'
import { LeadListTableSkeleton } from './lead-list-table-skeleton'
import type { Lead } from '../../lib/api-client'

export { LeadListTableSkeleton }

interface LeadListTableProps {
  leads: Lead[]
  selectedIds: Set<string>
  onSelect: (id: string, selected: boolean) => void
  onSelectAll: (selected: boolean) => void
  onConvert: (lead: Lead) => void
  onRowClick: (lead: Lead) => void
  isLoading?: boolean
}

export function LeadListTable({
  leads, selectedIds, onSelect, onSelectAll, onConvert, onRowClick, isLoading,
}: LeadListTableProps) {
  const { t } = useTranslation()

  if (isLoading) {
    return <LeadListTableSkeleton />
  }

  if (leads.length === 0) {
    return <LeadEmptyState />
  }

  const allSelected = leads.length > 0 &&
    leads.filter((l) => l.status !== 'CONVERTED').every((l) => selectedIds.has(l.id))

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/50">
              <th className="px-4 py-3 w-10">
                <label className="relative flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="peer sr-only"
                    aria-label={t('leads.selectAll')}
                  />
                  <div className="h-4 w-4 rounded border-2 border-muted-foreground/40 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors flex items-center justify-center">
                    {allSelected && (
                      <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </label>
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {t('leads.name')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {t('leads.phone')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {t('leads.statusLabel')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                {t('leads.source')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {t('leads.business')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                {t('leads.created')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {t('leads.actions')}
              </th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead, index) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                selected={selectedIds.has(lead.id)}
                onSelect={onSelect}
                onConvert={onConvert}
                onRowClick={onRowClick}
                isLast={index === leads.length - 1}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface LeadRowProps {
  lead: Lead
  selected: boolean
  onSelect: (id: string, selected: boolean) => void
  onConvert: (lead: Lead) => void
  onRowClick: (lead: Lead) => void
  isLast: boolean
}

const LeadRow = memo(function LeadRow({
  lead, selected, onSelect, onConvert, onRowClick, isLast,
}: LeadRowProps) {
  const { i18n, t } = useTranslation()
  const isConverted = lead.status === 'CONVERTED'
  const avatarColor = useMemo(() => getAvatarColor(`${lead.firstName} ${lead.lastName}`), [lead.firstName, lead.lastName])

  return (
    <tr
      onClick={() => onRowClick(lead)}
      className={cn(
        'hover:bg-muted/40 transition-colors duration-150 cursor-pointer',
        !isLast && 'border-b border-border/40',
        selected && 'bg-primary/5'
      )}
    >
      {/* Checkbox */}
      <td className="px-4 py-3 w-10">
        <label
          className={cn('relative flex items-center', isConverted ? 'cursor-not-allowed opacity-40' : 'cursor-pointer')}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            checked={selected}
            disabled={isConverted}
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

      {/* Name + Email */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
            avatarColor.bg,
            avatarColor.text
          )}>
            <span className="font-semibold text-sm">
              {getInitials(`${lead.firstName} ${lead.lastName}`)}
            </span>
          </div>
          <div>
            <p className="font-medium text-foreground">{lead.firstName} {lead.lastName}</p>
            {lead.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" aria-hidden="true" />
                {lead.email}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Phone */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-muted-foreground">{formatPhone(lead.phone)}</span>
      </td>

      {/* Status */}
      <td className="px-4 py-3">
        <LeadStatusBadge status={lead.status} />
      </td>

      {/* Source */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-muted-foreground">{lead.source || '—'}</span>
      </td>

      {/* Business */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-muted-foreground">{lead.businessName || '—'}</span>
      </td>

      {/* Created */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-muted-foreground">
          {formatShortRelativeTime(lead.createdAt, i18n.language)}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        {isConverted && lead.convertedToId ? (
          <Link
            to="/clients/$clientId"
            params={{ clientId: lead.convertedToId }}
            onClick={(e) => e.stopPropagation()}
            className="text-sm text-primary hover:underline flex items-center gap-1"
          >
            {t('leads.viewClient')}
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        ) : !isConverted ? (
          <button
            onClick={(e) => { e.stopPropagation(); onConvert(lead) }}
            className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            {t('leads.convert')}
          </button>
        ) : null}
      </td>
    </tr>
  )
})

function LeadEmptyState() {
  const { t } = useTranslation()
  return (
    <div className="bg-card rounded-xl shadow-sm p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Users className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-foreground mb-1">{t('leads.noLeads')}</h3>
      <p className="text-sm text-muted-foreground">{t('leads.noLeadsDesc')}</p>
    </div>
  )
}
