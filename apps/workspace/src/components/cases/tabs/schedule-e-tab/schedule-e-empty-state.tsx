/**
 * Schedule E Empty State - Shows when no rental form has been sent yet
 * Displays description and send button (no 1099-NEC detection needed)
 */
import { Home, Send, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import { useScheduleEActions } from '../../../../hooks/use-schedule-e-actions'

interface ScheduleEEmptyStateProps {
  caseId: string
}

export function ScheduleEEmptyState({ caseId }: ScheduleEEmptyStateProps) {
  const { t } = useTranslation()
  const { sendForm } = useScheduleEActions({ caseId })

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-col items-center text-center py-8">
        {/* Icon */}
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4" aria-hidden="true">
          <Home className="w-6 h-6 text-primary" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('scheduleE.emptyTitle')}
        </h3>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-6 max-w-md">
          {t('scheduleE.emptyDesc')}
        </p>

        {/* Send Button */}
        <Button
          onClick={() => sendForm.mutate()}
          disabled={sendForm.isPending}
          size="lg"
          className="gap-2 px-16"
          aria-label={t('scheduleE.sendButton')}
        >
          {sendForm.isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              {t('scheduleE.sending')}
            </>
          ) : (
            <>
              <Send className="w-4 h-4" aria-hidden="true" />
              {t('scheduleE.sendButton')}
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
