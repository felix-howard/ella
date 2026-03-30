/**
 * Lead Card - Individual lead display with actions
 */
import { useTranslation } from 'react-i18next'
import { Phone, Mail, Building2, Calendar, ArrowRight } from 'lucide-react'
import { Link } from '@tanstack/react-router'
import { cn } from '@ella/ui'
import { LeadStatusBadge } from './lead-status-badge'
import type { Lead } from '../../lib/api-client'

interface LeadCardProps {
  lead: Lead
  selected: boolean
  onSelect: (id: string, selected: boolean) => void
  onConvert: (lead: Lead) => void
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-10)
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  return phone
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export function LeadCard({ lead, selected, onSelect, onConvert }: LeadCardProps) {
  const { t } = useTranslation()
  const isConverted = lead.status === 'CONVERTED'

  return (
    <div className={cn(
      'bg-card rounded-lg border border-border p-4 transition-colors',
      selected && 'border-primary bg-primary/5'
    )}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onSelect(lead.id, e.target.checked)}
          disabled={isConverted}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          aria-label={`Select ${lead.firstName} ${lead.lastName}`}
        />

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="font-medium text-foreground truncate">
              {lead.firstName} {lead.lastName}
            </h3>
            <LeadStatusBadge status={lead.status} />
          </div>

          <div className="space-y-1 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 shrink-0" />
              <span>{formatPhone(lead.phone)}</span>
            </div>
            {lead.email && (
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{lead.email}</span>
              </div>
            )}
            {lead.businessName && (
              <div className="flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{lead.businessName}</span>
              </div>
            )}
            <div className="flex items-center gap-3 text-xs">
              {lead.campaignTag && (
                <span>{t('leads.source')}: {lead.campaignTag}</span>
              )}
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {formatDate(lead.createdAt)}
              </span>
            </div>
          </div>
        </div>

        <div className="shrink-0">
          {isConverted && lead.convertedToId ? (
            <Link
              to="/clients/$clientId"
              params={{ clientId: lead.convertedToId }}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              {t('leads.viewClient')}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : lead.status !== 'CONVERTED' ? (
            <button
              onClick={() => onConvert(lead)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
            >
              {t('leads.convert')}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
