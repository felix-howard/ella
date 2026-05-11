/**
 * Lead detail header — unified identity card matching team-profile look & feel.
 * Uses shared DetailHeaderCard primitive for consistent card treatment.
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
import { ConvertLeadDialog } from '../convert-lead-dialog'
import { DetailHeaderCard } from '../../shared'
import {
  formatPhone,
  formatShortRelativeTime,
  getInitials,
  getAvatarColor,
} from '../../../lib/formatters'
import { LeadStatusMenu } from './lead-status-menu'
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

  const avatarNode = (
    <div
      className={cn(
        'w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
        avatar.bg,
        avatar.text,
      )}
    >
      <span className="font-bold text-base">{getInitials(fullName)}</span>
    </div>
  )

  const nameNode = (
    <span className="inline-flex items-center gap-2 flex-wrap align-middle">
      <span>{fullName}</span>
      <LeadStatusMenu lead={lead} />
      {sourceLabel && (
        <>
          <span className="text-border font-normal">|</span>
          <span className="text-xs font-normal text-muted-foreground">
            {t('leads.source')}:
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
            <Globe className="w-3 h-3" aria-hidden="true" />
            {sourceLabel}
          </span>
        </>
      )}
    </span>
  )

  const metaNode = (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
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
      {customTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
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
    </>
  )

  const actionsNode = (
    <>
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
    </>
  )

  return (
    <>
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t('leads.backToList')}</span>
      </Link>

      <DetailHeaderCard
        avatar={avatarNode}
        name={nameNode}
        meta={metaNode}
        actions={actionsNode}
      />

      {showConvert && (
        <ConvertLeadDialog lead={lead} onClose={() => setShowConvert(false)} />
      )}
    </>
  )
}
