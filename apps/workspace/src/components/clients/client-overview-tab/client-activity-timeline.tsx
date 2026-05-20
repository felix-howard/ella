import { useTranslation } from 'react-i18next'
import { ActivityTimeline } from '../../activity'

interface ClientActivityTimelineProps {
  clientId: string
}

export function ClientActivityTimeline({ clientId }: ClientActivityTimelineProps) {
  const { t } = useTranslation()

  return (
    <ActivityTimeline
      scope="client"
      clientId={clientId}
      title={t('clientOverview.recentActivity')}
    />
  )
}
