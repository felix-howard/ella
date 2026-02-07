/**
 * RentalSuccessMessage Component
 * Success screen after form submission
 */
import { memo } from 'react'
import { CheckCircle2, Edit2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useTranslation } from 'react-i18next'

interface RentalSuccessMessageProps {
  version: number
  onEditAgain: () => void
}

export const RentalSuccessMessage = memo(function RentalSuccessMessage({
  version,
  onEditAgain,
}: RentalSuccessMessageProps) {
  const { t } = useTranslation()

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        {/* Success icon */}
        <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-success" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          {t('rental.successTitle')}
        </h2>

        {/* Message */}
        <p className="text-muted-foreground mb-4">
          {t('rental.successMessage')}
        </p>

        {/* Version */}
        <p className="text-sm text-muted-foreground mb-6">
          {t('rental.version', { version })}
        </p>

        {/* CPA review note */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-muted-foreground">
            {t('rental.cpaReview')}
          </p>
        </div>

        {/* Edit again button */}
        <Button
          variant="outline"
          onClick={onEditAgain}
          className="gap-2"
        >
          <Edit2 className="w-4 h-4" />
          {t('rental.editAgain')}
        </Button>

        {/* Can edit note */}
        <p className="text-xs text-muted-foreground mt-4">
          {t('rental.canEditAnytime')}
        </p>
      </div>
    </div>
  )
})

RentalSuccessMessage.displayName = 'RentalSuccessMessage'
