import { Link } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

export interface LeadMessageLoadErrorProps {
  backLabel: string
  title: string
  description: string
}

export function LeadMessageLoadError({
  backLabel,
  title,
  description,
}: LeadMessageLoadErrorProps) {
  return (
    <div className="h-full flex flex-col min-h-0 bg-background">
      <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Link
          to="/lead-messages"
          className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={backLabel}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
