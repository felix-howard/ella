/**
 * Contractor Intake Success View - Shown after successful batch submission
 */
import { CheckCircle, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@ella/ui'

interface SubmittedContractor {
  firstName: string
  lastName: string
  ssnLast4: string
}

interface ContractorIntakeSuccessProps {
  contractors: SubmittedContractor[]
  onAddMore: () => void
}

export function ContractorIntakeSuccess({
  contractors,
  onAddMore,
}: ContractorIntakeSuccessProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-6">
        <CheckCircle className="w-8 h-8 text-primary" />
      </div>

      <h2 className="text-xl font-bold text-foreground mb-2">
        {t('contractorIntake.success')}
      </h2>

      <p className="text-muted-foreground max-w-xs mb-6">
        {contractors.length === 1
          ? t('contractorIntake.successMessage', {
              name: `${contractors[0].firstName} ${contractors[0].lastName}`,
              last4: contractors[0].ssnLast4,
            })
          : t('contractorIntake.successMessageMultiple', {
              count: contractors.length,
            })}
      </p>

      {/* List submitted contractors */}
      {contractors.length > 1 && (
        <div className="w-full max-w-sm space-y-2 mb-8">
          {contractors.map((c, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border/50 bg-muted/20 text-left"
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  ***-**-{c.ssnLast4}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button onClick={onAddMore} className="rounded-xl px-6">
        {t('contractorIntake.addAnother')}
      </Button>
    </div>
  )
}
