/**
 * Form Header - Branded header with Ella logo, org name, and optional CPA name
 */
import { useTranslation } from 'react-i18next'
import { EllaLogoFull } from '@ella/ui'

interface FormHeaderProps {
  orgName: string
  orgLogo?: string | null
  staffName?: string
}

export function FormHeader({ orgName, orgLogo, staffName }: FormHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="text-center py-8 px-6 border-b border-border/50">
      <img
        src={EllaLogoFull}
        alt="ella.tax"
        className="h-10 mx-auto mb-6"
      />

      {orgLogo ? (
        <img
          src={orgLogo}
          alt={orgName}
          className="w-16 h-16 rounded-xl object-cover mx-auto mb-4"
        />
      ) : (
        <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl font-bold text-primary">
            {orgName.charAt(0).toUpperCase()}
          </span>
        </div>
      )}

      <h1 className="text-xl font-bold text-foreground">{orgName}</h1>

      {staffName && (
        <p className="text-sm text-muted-foreground mt-1">
          {t('form.cpaLabel', { name: staffName })}
        </p>
      )}

      <p className="text-sm text-muted-foreground mt-3 max-w-xs mx-auto">
        {t('form.description')}
      </p>
    </div>
  )
}
