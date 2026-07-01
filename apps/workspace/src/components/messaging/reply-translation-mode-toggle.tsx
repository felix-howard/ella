import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '@ella/ui'
import type { ReplyMode } from '../../lib/api-client'

interface ReplyTranslationModeToggleProps {
  replyMode: ReplyMode
  disabled?: boolean
  onReplyModeChange: (mode: ReplyMode) => void
}

const REPLY_MODES: ReplyMode[] = ['DIRECT', 'EN_TO_VI']

export function ReplyTranslationModeToggle({
  replyMode,
  disabled,
  onReplyModeChange,
}: ReplyTranslationModeToggleProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2 pb-2">
      <Languages className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
      <div
        className="inline-flex rounded-lg border border-border/60 bg-muted/40 p-0.5"
        aria-label={t('messages.replyModeLabel')}
      >
        {REPLY_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            disabled={disabled || replyMode === mode}
            onClick={() => onReplyModeChange(mode)}
            aria-pressed={replyMode === mode}
            className={cn(
              'min-w-16 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
              'focus:outline-none focus:ring-2 focus:ring-primary/30',
              replyMode === mode
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/70',
              disabled && 'opacity-60 cursor-not-allowed'
            )}
          >
            {t(mode === 'DIRECT' ? 'messages.replyModeDirect' : 'messages.replyModeEnToVi')}
          </button>
        ))}
      </div>
    </div>
  )
}
