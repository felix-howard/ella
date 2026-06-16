import { Type, Eye, EyeOff } from 'lucide-react'
import { cn } from '@ella/ui'
import type { RegistrationHeaderMode } from '../../lib/api-client'

interface RegistrationHeaderFieldsProps {
  mode: RegistrationHeaderMode
  title: string
  subtitle: string
  onModeChange: (mode: RegistrationHeaderMode) => void
  onTitleChange: (title: string) => void
  onSubtitleChange: (subtitle: string) => void
  legend: string
  description: string
  defaultLabel: string
  customLabel: string
  hiddenLabel: string
  defaultHelper: string
  customHelper: string
  hiddenHelper: string
  titleLabel: string
  subtitleLabel: string
  titlePlaceholder: string
  subtitlePlaceholder: string
  disabled?: boolean
}

const MODE_OPTIONS: Array<{ value: RegistrationHeaderMode; icon: typeof Type }> = [
  { value: 'DEFAULT', icon: Type },
  { value: 'CUSTOM', icon: Eye },
  { value: 'HIDDEN', icon: EyeOff },
]

export function RegistrationHeaderFields({
  mode,
  title,
  subtitle,
  onModeChange,
  onTitleChange,
  onSubtitleChange,
  legend,
  description,
  defaultLabel,
  customLabel,
  hiddenLabel,
  defaultHelper,
  customHelper,
  hiddenHelper,
  titleLabel,
  subtitleLabel,
  titlePlaceholder,
  subtitlePlaceholder,
  disabled = false,
}: RegistrationHeaderFieldsProps) {
  const labels = {
    DEFAULT: defaultLabel,
    CUSTOM: customLabel,
    HIDDEN: hiddenLabel,
  }
  const helper = {
    DEFAULT: defaultHelper,
    CUSTOM: customHelper,
    HIDDEN: hiddenHelper,
  }[mode]

  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-xs font-medium text-muted-foreground">{legend}</legend>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {MODE_OPTIONS.map(({ value, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            disabled={disabled}
            className={cn(
              'inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
              mode === value
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:bg-muted',
              disabled && 'cursor-not-allowed opacity-50'
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{labels[value]}</span>
          </button>
        ))}
      </div>

      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">{helper}</p>

      {mode === 'CUSTOM' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {titleLabel}
            </label>
            <input
              type="text"
              value={title}
              onChange={(event) => onTitleChange(event.target.value)}
              placeholder={titlePlaceholder}
              maxLength={120}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {subtitleLabel}
            </label>
            <input
              type="text"
              value={subtitle}
              onChange={(event) => onSubtitleChange(event.target.value)}
              placeholder={subtitlePlaceholder}
              maxLength={240}
              disabled={disabled}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </fieldset>
  )
}
