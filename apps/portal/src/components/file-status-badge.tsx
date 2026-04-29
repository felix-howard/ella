/**
 * File Status Badge
 * Pure presentational badge mapping rawImage status -> icon + i18n label.
 */
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle2, AlertTriangle, Info, Files } from 'lucide-react'
import type { UploadedFileStatus } from '../lib/api-client'

interface FileStatusBadgeProps {
  status: UploadedFileStatus
}

interface BadgeStyle {
  Icon: React.ComponentType<{ className?: string }>
  className: string
  spin?: boolean
}

const STATUS_STYLES: Record<UploadedFileStatus, BadgeStyle> = {
  UPLOADED: { Icon: Loader2, className: 'text-muted-foreground', spin: true },
  PROCESSING: { Icon: Loader2, className: 'text-muted-foreground', spin: true },
  CLASSIFIED: { Icon: CheckCircle2, className: 'text-success' },
  LINKED: { Icon: CheckCircle2, className: 'text-success' },
  BLURRY: { Icon: AlertTriangle, className: 'text-warning' },
  UNCLASSIFIED: { Icon: Info, className: 'text-muted-foreground' },
  DUPLICATE: { Icon: Files, className: 'text-muted-foreground' },
}

export function FileStatusBadge({ status }: FileStatusBadgeProps) {
  const { t } = useTranslation()
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.UPLOADED
  const { Icon, className, spin } = style
  const label = t(`portal.fileStatus.${status.toLowerCase()}`)

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${className}`}
      role="status"
      aria-label={label}
    >
      <Icon
        className={`w-3.5 h-3.5 ${spin ? 'animate-spin' : ''}`}
        aria-hidden="true"
      />
      <span>{label}</span>
    </span>
  )
}
