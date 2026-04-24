/**
 * Lead detail header — unified identity card matching client-detail look & feel.
 * Contains: avatar, name, status badge, source chip, contact metadata row,
 * custom tag chips, and primary action buttons (Convert / View client).
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ArrowRight,
  UserPlus,
  Phone,
  Mail,
  Building2,
  Calendar,
  Globe,
} from 'lucide-react'
import { Button, buttonVariants, cn } from '@ella/ui'
import { LeadStatusBadge } from '../lead-status-badge'
import { ConvertLeadDialog } from '../convert-lead-dialog'
import {
  formatPhone,
  formatShortRelativeTime,
  getInitials,
  getAvatarColor,
} from '../../../lib/formatters'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadDetailHeader({ lead }: Props) {
  const { t, i18n } = useTranslation()
  const [showConvert, setShowConvert] = useState(false)

  const isConverted = lead.status === 'CONVERTED'
  const fullName = `${lead.firstName} ${lead.lastName ?? ''}`.trim() || '—'
  const avatar = getAvatarColor(fullName)
  const sourceLabel = lead.campaignName || lead.campaignTag || null
  const customTags = (lead.tags ?? []).filter((tag) => tag !== lead.campaignTag)

  return (
    <>
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t('leads.backToList')}</span>
      </Link>

      <div className="bg-card border border-border/60 rounded-lg shadow-none mb-6">
        <div className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
            {/* Left: Avatar + Identity */}
            <div className="flex items-start gap-3.5 min-w-0">
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
                  avatar.bg,
                  avatar.text,
                )}
              >
                <span className="font-bold text-base">{getInitials(fullName)}</span>
              </div>

              <div className="min-w-0">
                {/* Name row with status + source */}
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-semibold text-foreground leading-tight">
                    {fullName}
                  </h1>
                  <LeadStatusBadge status={lead.status} />
                  {sourceLabel && (
                    <>
                      <span className="text-border">|</span>
                      <span className="text-xs text-muted-foreground">
                        {t('leads.source')}:
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                        <Globe className="w-3 h-3" aria-hidden="true" />
                        {sourceLabel}
                      </span>
                    </>
                  )}
                </div>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[13px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatPhone(lead.phone)}
                  </span>
                  {lead.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5" aria-hidden="true" />
                      {lead.email}
                    </span>
                  )}
                  {lead.businessName && (
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" aria-hidden="true" />
                      {lead.businessName}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" aria-hidden="true" />
                    {formatShortRelativeTime(lead.createdAt, i18n.language)}
                  </span>
                </div>

                {/* Custom tags (excludes campaign tag already shown as source) */}
                {customTags.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 mt-1.5">
                    {customTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[11px] font-medium bg-muted text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
              {isConverted && lead.convertedToId && (
                <Link
                  to="/clients/$clientId"
                  params={{ clientId: lead.convertedToId }}
                  className={cn(buttonVariants({ size: 'sm' }))}
                >
                  {t('leads.viewClient')}
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Link>
              )}
              {!isConverted && (
                <Button size="sm" onClick={() => setShowConvert(true)}>
                  <UserPlus className="w-4 h-4 mr-1" />
                  {t('leads.convertTitle')}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConvert && (
        <ConvertLeadDialog lead={lead} onClose={() => setShowConvert(false)} />
      )}
    </>
  )
}
