/**
 * Form Header - Branded header with Ella logo, org name, and optional CPA name
 */
import { useTranslation } from 'react-i18next'
import { EllaLogoFull } from '@ella/ui'

interface FormHeaderProps {
  orgName: string
  staffName?: string
  showDescription?: boolean
  variant?: 'default' | 'compact'
}

export function FormHeader({
  orgName,
  staffName,
  showDescription = true,
  variant = 'default',
}: FormHeaderProps) {
  const { t } = useTranslation()

  if (variant === 'compact') {
    return (
      <header className="px-4 pb-3 pt-7 text-center sm:pb-4 sm:pt-8">
        <div className="mx-auto inline-flex max-w-full items-center gap-3 rounded-full border border-white/80 bg-white/75 px-4 py-2.5 shadow-sm backdrop-blur-md">
          <img
            src={EllaLogoFull}
            alt="ella.tax"
            className="h-7 w-auto shrink-0 sm:h-8"
          />
          <span className="h-5 w-px shrink-0 bg-border" aria-hidden="true" />
          <h1 className="truncate text-sm font-semibold text-foreground sm:text-base">{orgName}</h1>
        </div>

        {staffName && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('form.cpaLabel', { name: staffName })}
          </p>
        )}
      </header>
    )
  }

  return (
    <div className="text-center py-8 px-6 border-b border-border/50">
      <img
        src={EllaLogoFull}
        alt="ella.tax"
        className="h-10 mx-auto mb-6"
      />

      <h1 className="text-xl font-bold text-foreground">{orgName}</h1>

      {staffName && (
        <p className="text-sm text-muted-foreground mt-1">
          {t('form.cpaLabel', { name: staffName })}
        </p>
      )}

      {showDescription && (
        <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
          {t('form.description')}
        </p>
      )}
    </div>
  )
}
