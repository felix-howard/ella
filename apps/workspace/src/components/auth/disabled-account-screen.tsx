import { Button } from '@ella/ui'
import { LogOut, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface DisabledAccountScreenProps {
  onSignOut?: () => void
}

export function DisabledAccountScreen({ onSignOut }: DisabledAccountScreenProps) {
  const { t } = useTranslation()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <ShieldOff className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          {t('auth.accountDisabledTitle', 'Your account has been disabled.')}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t('auth.accountDisabledDescription', 'Contact admin if you need access to Ella Workspace.')}
        </p>
        {onSignOut && (
          <Button type="button" variant="outline" onClick={onSignOut} className="mt-6 gap-2">
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {t('auth.accountDisabledSignOut', 'Sign out')}
          </Button>
        )}
      </div>
    </div>
  )
}
