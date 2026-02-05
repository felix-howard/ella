/**
 * SuccessMessage Component
 * Post-submission confirmation with option to edit
 */
import { CheckCircle, Edit3 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useTranslation } from 'react-i18next'

interface SuccessMessageProps {
  version: number
  onEdit: () => void
}

export function SuccessMessage({ version, onEdit }: SuccessMessageProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col items-center justify-center py-8 px-6 text-center">
      {/* Success icon */}
      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
        <CheckCircle className="w-8 h-8 text-success" />
      </div>

      {/* Title */}
      <h2 className="text-xl font-semibold text-foreground mb-2">
        {t('expense.successTitle')}
      </h2>

      {/* Description */}
      <p className="text-muted-foreground mb-6 max-w-sm">
        {t('expense.successMessage')}
        {version > 1 && (
          <span className="block mt-1 text-sm">
            {t('expense.version', { version })}
          </span>
        )}
      </p>

      {/* CPA review note */}
      <div className="p-4 bg-primary/5 rounded-lg border border-primary/10 mb-6 max-w-sm">
        <p className="text-sm text-foreground">
          {t('expense.cpaReview')}
        </p>
      </div>

      {/* Edit button */}
      <Button
        onClick={onEdit}
        variant="outline"
        className="gap-2"
      >
        <Edit3 className="w-4 h-4" />
        {t('expense.editAgain')}
      </Button>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground mt-6">
        {t('expense.canEditAnytime')}
      </p>
    </div>
  )
}
