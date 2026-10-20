import { Ban, CheckCircle2, Link2Off } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { UploadLinkData } from '../../lib/api-client'

interface UploadLinkStatusBadgeProps {
  link: UploadLinkData | null
}

export function UploadLinkStatusBadge({ link }: UploadLinkStatusBadgeProps) {
  const { t } = useTranslation()
  const state = !link ? 'none' : link.status.toLowerCase()
  const Icon = state === 'active' ? CheckCircle2
    : state === 'replaced' ? Link2Off
      : Ban

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        state === 'active' && 'bg-emerald-500/10 text-emerald-600',
        (state === 'revoked' || state === 'replaced') && 'bg-destructive/10 text-destructive',
        state === 'none' && 'bg-muted text-muted-foreground'
      )}
    >
      <Icon className="h-3 w-3" />
      {t(`uploadLinks.status.${state}`)}
    </span>
  )
}
