import { AlertTriangle, Ban, CheckCircle2, Clock, Link2Off } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { UploadLinkData } from '../../lib/api-client'
import { isUploadLinkExpiringSoon } from './upload-link-state'

interface UploadLinkStatusBadgeProps {
  link: UploadLinkData | null
}

export function UploadLinkStatusBadge({ link }: UploadLinkStatusBadgeProps) {
  const { t } = useTranslation()
  const expiringSoon = isUploadLinkExpiringSoon(link)

  const state = !link ? 'none' : expiringSoon ? 'expiringSoon' : link.status.toLowerCase()
  const Icon = state === 'active' ? CheckCircle2
    : state === 'expiringSoon' ? AlertTriangle
      : state === 'expired' ? Clock
        : state === 'replaced' ? Link2Off
          : Ban

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        state === 'active' && 'bg-emerald-500/10 text-emerald-600',
        state === 'expiringSoon' && 'bg-amber-500/10 text-amber-600',
        (state === 'expired' || state === 'revoked' || state === 'replaced') && 'bg-destructive/10 text-destructive',
        state === 'none' && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {t(`uploadLinks.status.${state}`)}
    </span>
  )
}
