/**
 * Success View - Thank you message after form submission
 */
import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface SuccessViewProps {
  smsSent: boolean
}

export function SuccessView({ smsSent }: SuccessViewProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        {t('form.successTitle')}
      </h2>

      <p className="text-muted-foreground max-w-xs">
        {smsSent ? t('form.successMessageWithSms') : t('form.successMessage')}
      </p>
    </div>
  )
}
