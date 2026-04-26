import type { ReactNode } from 'react'
import { cn } from '@ella/ui'
import type { LucideIcon } from 'lucide-react'

type CardSectionProps = {
  title?: ReactNode
  icon?: LucideIcon
  action?: ReactNode
  tone?: 'default' | 'destructive'
  className?: string
  bodyClassName?: string
  children: ReactNode
}

export function CardSection({
  title,
  icon: Icon,
  action,
  tone = 'default',
  className,
  bodyClassName,
  children,
}: CardSectionProps) {
  const isDestructive = tone === 'destructive'

  return (
    <section
      className={cn(
        'bg-card rounded-xl shadow-sm overflow-hidden',
        isDestructive && 'border border-destructive/30',
        className,
      )}
    >
      {title !== undefined && (
        <div
          className={cn(
            'flex items-center justify-between px-6 py-4 border-b',
            isDestructive
              ? 'bg-destructive/5 border-destructive/20'
              : 'bg-muted/50 border-border',
          )}
        >
          <h2
            className={cn(
              'flex items-center gap-2 text-lg font-semibold',
              isDestructive ? 'text-destructive' : 'text-foreground',
            )}
          >
            {Icon && (
              <Icon
                className={cn(
                  'w-5 h-5',
                  isDestructive ? 'text-destructive' : 'text-muted-foreground',
                )}
              />
            )}
            {title}
          </h2>
          {action && <div className="flex items-center gap-2">{action}</div>}
        </div>
      )}
      <div className={cn('p-6', bodyClassName)}>{children}</div>
    </section>
  )
}
