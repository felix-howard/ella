import type { ReactNode } from 'react'
import { cn } from '@ella/ui'

type DetailHeaderCardProps = {
  avatar: ReactNode
  name: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function DetailHeaderCard({
  avatar,
  name,
  subtitle,
  meta,
  actions,
  className,
}: DetailHeaderCardProps) {
  return (
    <div className={cn('bg-card rounded-xl shadow-sm p-6 mb-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-5 min-w-0">
          {avatar}
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-foreground leading-tight">{name}</h1>
            {subtitle && (
              <div className="text-sm text-muted-foreground mt-0.5">{subtitle}</div>
            )}
            {meta && <div className="mt-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  )
}
