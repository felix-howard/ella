/**
 * Schedule C Empty State - Shows when no expense form has been sent yet
 * Displays description and send button with message customization modal
 */
import { useState } from 'react'
import { Calculator, Send, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useTranslation } from 'react-i18next'
import { useScheduleCActions } from '../../../../hooks/use-schedule-c-actions'
import {
  SendFormMessageModal,
  SCHEDULE_C_TEMPLATE_VI,
  SCHEDULE_C_TEMPLATE_EN,
} from '../../../shared'

interface ScheduleCEmptyStateProps {
  caseId: string
  clientName: string
}

export function ScheduleCEmptyState({ caseId, clientName }: ScheduleCEmptyStateProps) {
  const { t } = useTranslation()
  const { sendForm } = useScheduleCActions({ caseId })
  const [isModalOpen, setIsModalOpen] = useState(false)

  const handleSend = (customMessage: string) => {
    sendForm.mutate(customMessage, {
      onSuccess: () => setIsModalOpen(false),
    })
  }

  return (
    <>
      <div className="bg-card rounded-2xl shadow-sm dark:shadow-none dark:border dark:border-white/[0.06] p-6">
        <div className="flex flex-col items-center text-center py-8">
          {/* Icon */}
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4" aria-hidden="true">
            <Calculator className="w-6 h-6 text-primary" />
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {t('scheduleC.emptyTitle')}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            {t('scheduleC.emptyDesc')}
          </p>

          {/* Send Button - Opens Modal */}
          <Button
            onClick={() => setIsModalOpen(true)}
            disabled={sendForm.isPending}
            size="lg"
            className="gap-2 px-16"
            aria-label={t('scheduleC.sendButton')}
          >
            {sendForm.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                {t('scheduleC.sending')}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" aria-hidden="true" />
                {t('scheduleC.sendButton')}
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
        formType="scheduleC"
        clientName={clientName}
        defaultTemplateVI={SCHEDULE_C_TEMPLATE_VI}
        defaultTemplateEN={SCHEDULE_C_TEMPLATE_EN}
      />
    </>
  )
}
