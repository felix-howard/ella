import { Calendar, Phone, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatPhone } from '../../lib/formatters'

interface ClientConfirmSummaryProps {
  clientName: string
  phone: string
  taxYear: number
}

export function ClientConfirmSummary({ clientName, phone, taxYear }: ClientConfirmSummaryProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <h3 className="text-lg font-semibold text-primary mb-4">{t('confirmStep.title')}</h3>
      <dl className="space-y-3">
        <div className="flex items-center justify-between py-2 border-b border-border">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4" />
            {t('confirmStep.name')}
          </dt>
          <dd className="font-medium text-foreground">{clientName}</dd>
        </div>
        <div className="flex items-center justify-between py-2 border-b border-border">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Phone className="w-4 h-4" />
            {t('confirmStep.phone')}
          </dt>
          <dd className="font-medium text-foreground">{formatPhone(phone)}</dd>
        </div>
        <div className="flex items-center justify-between py-2">
          <dt className="flex items-center gap-2 text-muted-foreground">
            <Calendar className="w-4 h-4" />
            {t('confirmStep.taxYear')}
          </dt>
          <dd className="font-medium text-foreground">{taxYear}</dd>
        </div>
      </dl>
    </div>
  )
}
