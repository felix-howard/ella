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
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      {/* Success icon */}
      <div className="w-20 h-20 rounded-2xl bg-success/10 flex items-center justify-center mb-5 shadow-sm">
        <CheckCircle className="w-10 h-10 text-success" />
      </div>

      {/* Title */}
      <h2 className="text-2xl font-semibold text-foreground mb-2">
        {t('expense.successTitle')}
      </h2>

      {/* Description */}
      <p className="text-muted-foreground/80 mb-6 max-w-sm">
        {t('expense.successMessage')}
        {version > 1 && (
          <span className="block mt-1.5 text-sm text-muted-foreground/60">
            {t('expense.version', { version })}
          </span>
        )}
      </p>

      {/* CPA review note */}
      <div className="p-4 bg-primary/5 rounded-xl mb-6 max-w-sm shadow-sm">
        <p className="text-sm text-foreground">
          {t('expense.cpaReview')}
        </p>
      </div>

      {/* Edit button */}
      <Button
        onClick={onEdit}
        variant="outline"
        className="gap-2 rounded-xl"
      >
        <Edit3 className="w-4 h-4" />
        {t('expense.editAgain')}
      </Button>

      {/* Footer note */}
      <p className="text-xs text-muted-foreground/60 mt-6">
        {t('expense.canEditAnytime')}
      </p>
    </div>
  )
}
