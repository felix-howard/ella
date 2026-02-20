/**
 * Schedule E Empty State - Shows when no rental form has been sent yet
 * Displays description and send button with message customization modal
 */
import { useState } from 'react'
import { Home, Send, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import { useScheduleEActions } from '../../../../hooks/use-schedule-e-actions'
import {
  SendFormMessageModal,
  SCHEDULE_E_TEMPLATE_VI,
  SCHEDULE_E_TEMPLATE_EN,
} from '../../../shared'

interface ScheduleEEmptyStateProps {
  caseId: string
  clientName: string
}

export function ScheduleEEmptyState({ caseId, clientName }: ScheduleEEmptyStateProps) {
  const { t } = useTranslation()
  const { sendForm } = useScheduleEActions({ caseId })
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSend = (customMessage: string) => {
    sendForm.mutate(customMessage, {
      onSuccess: () => setIsModalOpen(false),
    })
  }

  return (
    <>
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

          {/* Send Button - Opens Modal */}
          <Button
            onClick={() => setIsModalOpen(true)}
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

      {/* Message Customization Modal */}
      <SendFormMessageModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSend={handleSend}
        isSending={sendForm.isPending}
        formType="scheduleE"
        clientName={clientName}
        defaultTemplateVI={SCHEDULE_E_TEMPLATE_VI}
        defaultTemplateEN={SCHEDULE_E_TEMPLATE_EN}
      />
    </>
  )
}
