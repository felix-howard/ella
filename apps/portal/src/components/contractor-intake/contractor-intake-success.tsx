/**
 * Contractor Intake Success View - Shown after successful contractor submission
 */
import { CheckCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'

interface ContractorIntakeSuccessProps {
  contractor: { firstName: string; lastName: string; ssnLast4: string }
  submittedCount: number
  onAddAnother: () => void
}

export function ContractorIntakeSuccess({
  contractor,
  submittedCount,
  onAddAnother,
}: ContractorIntakeSuccessProps) {
  const { t } = useTranslation()
  const fullName = `${contractor.firstName} ${contractor.lastName}`

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        {t('contractorIntake.success')}
      </h2>

      <p className="text-muted-foreground max-w-xs mb-2">
        {t('contractorIntake.successMessage', { name: fullName, last4: contractor.ssnLast4 })}
      </p>

      <p className="text-sm text-muted-foreground mb-8">
        {t('contractorIntake.submitted', { count: submittedCount })}
      </p>

      <Button onClick={onAddAnother} className="rounded-xl px-6">
        {t('contractorIntake.addAnother')}
      </Button>
    </div>
  )
}
