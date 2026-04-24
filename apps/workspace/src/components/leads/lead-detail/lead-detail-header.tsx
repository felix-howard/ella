/**
 * Lead detail header — back link, name + status badge, action buttons.
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, ArrowRight, UserPlus } from 'lucide-react'
import { Button, buttonVariants, cn } from '@ella/ui'
import { LeadStatusBadge } from '../lead-status-badge'
import { ConvertLeadDialog } from '../convert-lead-dialog'
import type { Lead } from '../../../lib/api-client'

interface Props {
  lead: Lead
}

export function LeadDetailHeader({ lead }: Props) {
  const { t } = useTranslation()
  const [showConvert, setShowConvert] = useState(false)

  const isConverted = lead.status === 'CONVERTED'
  const fullName = `${lead.firstName} ${lead.lastName ?? ''}`.trim()

  return (
    <>
      <Link
        to="/leads"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        <span>{t('leads.backToList')}</span>
      </Link>

      <div className="bg-card border border-border/60 rounded-xl shadow-sm mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 sm:p-5">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-xl font-semibold text-foreground leading-tight truncate">
              {fullName}
            </h1>
            <LeadStatusBadge status={lead.status} />
          </div>

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

      {showConvert && <ConvertLeadDialog lead={lead} onClose={() => setShowConvert(false)} />}
    </>
  )
}
