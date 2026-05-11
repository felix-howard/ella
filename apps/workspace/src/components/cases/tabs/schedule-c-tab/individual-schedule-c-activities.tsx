import type { ElementType } from 'react'
import type { ClientGroup, ClientPreview } from '../../../../lib/api-client'
import { ScheduleCBusinessSummaryList } from './schedule-c-business-summary-list'

interface ScheduleCTabComponentProps {
  caseId: string
  clientName: string
  businessName?: string | null
  currentClientId?: string
  sourceTaxYear?: number
  clientGroup?: ClientGroup | null
}

interface IndividualScheduleCActivitiesProps extends ScheduleCTabComponentProps {
  linkedBusinesses: ClientPreview[]
  ScheduleCTabComponent: ElementType<ScheduleCTabComponentProps>
}

export function IndividualScheduleCActivities({
  linkedBusinesses,
  ScheduleCTabComponent,
  ...scheduleCTabProps
}: IndividualScheduleCActivitiesProps) {
  return (
    <div className="space-y-6">
      <ScheduleCTabComponent {...scheduleCTabProps} />
      {linkedBusinesses.length > 0 && (
        <ScheduleCBusinessSummaryList businesses={linkedBusinesses} />
      )}
    </div>
  )
}
