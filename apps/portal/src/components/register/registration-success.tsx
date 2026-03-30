/**
 * Registration Success - Thank you view after lead registration
 */
import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function RegistrationSuccess() {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        {t('register.success.title')}
      </h2>

      <p className="text-muted-foreground max-w-xs mb-2">
        {t('register.success.message')}
      </p>

      <p className="text-sm text-muted-foreground/70">
        {t('register.success.note')}
      </p>
    </div>
  )
}
