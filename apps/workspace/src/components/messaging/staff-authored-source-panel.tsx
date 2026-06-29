import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@ella/ui'

export interface StaffAuthoredSourcePanelProps {
  content: string | null | undefined
  className?: string
}

export function StaffAuthoredSourcePanel({
  content,
  className,
}: StaffAuthoredSourcePanelProps) {
  const { t } = useTranslation()
  const [isVisible, setIsVisible] = useState(false)
  const panelId = useId()
  const safeContent = useMemo(() => (content ?? '').trim(), [content])

  if (!safeContent) return null

  const label = isVisible
    ? t('messages.hideEnglishSource')
    : t('messages.showEnglishSource')

  return (
    <div className={cn('mt-1 flex w-full max-w-full flex-col items-end gap-1', className)}>
      <button
        type="button"
        onClick={() => setIsVisible((current) => !current)}
        className={cn(
          'inline-flex min-h-11 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 sm:min-h-8 sm:px-2.5',
          'text-[11px] font-medium text-slate-600 shadow-sm transition-colors',
          'hover:border-slate-300 hover:bg-slate-50 hover:text-slate-800',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1',
          'dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
        )}
        aria-expanded={isVisible}
        aria-controls={panelId}
        aria-label={label}
      >
        {isVisible ? (
          <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span>{label}</span>
      </button>

      {isVisible && (
        <div
          id={panelId}
          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] leading-relaxed text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
          aria-label={t('messages.englishSourceLabel')}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
            {t('messages.englishSourceLabel')}
          </div>
          <p className="whitespace-pre-wrap break-words">{safeContent}</p>
        </div>
      )}
    </div>
  )
}
