/**
 * Settings General Tab - Theme, Language, Missed Call Text-Back
 */
import { Sun, Moon, Globe, PhoneMissed, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, cn } from '@ella/ui'
import { useTheme, type Theme } from '../../stores/ui-store'
import { useLanguageSync } from '../../hooks/use-language-sync'
import { api } from '../../lib/api-client'
import type { Language } from '../../lib/api-client'
import { useOrgRole } from '../../hooks/use-org-role'
import { FirmInfoCard } from './firm-info-card'

export function SettingsGeneralTab() {
  const { theme, setTheme } = useTheme()
  const { currentLanguage, changeLanguage } = useLanguageSync()

  return (
    <div className="space-y-4">
      <ThemeCard theme={theme} setTheme={setTheme} />
      <LanguageCard currentLanguage={currentLanguage} changeLanguage={changeLanguage} />
      <MissedCallTextBackCard />
      <FirmInfoCard />
    </div>
  )
}

export function ThemeCard({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
  const { t } = useTranslation()

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            {theme === 'dark' ? (
              <Moon className="w-4 h-4 text-primary" />
            ) : (
              <Sun className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('settings.theme')}</h3>
            <p className="text-xs text-muted-foreground">
              {theme === 'dark' ? t('settings.darkMode') : t('settings.lightMode')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-full bg-muted dark:bg-background">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'p-2 rounded-full transition-all cursor-pointer',
              theme === 'light'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={t('settings.lightMode')}
          >
            <Sun className="w-4 h-4" />
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              'p-2 rounded-full transition-all cursor-pointer',
              theme === 'dark'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={t('settings.darkMode')}
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  )
}

export function LanguageCard({ currentLanguage, changeLanguage }: { currentLanguage: Language; changeLanguage: (lang: Language) => void }) {
  const { t } = useTranslation()

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('settings.language')}</h3>
            <p className="text-xs text-muted-foreground">
              {currentLanguage === 'VI' ? 'Vietnamese' : 'English'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-full bg-muted dark:bg-background">
          <button
            onClick={() => changeLanguage('VI')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
              currentLanguage === 'VI'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            VI
          </button>
          <button
            onClick={() => changeLanguage('EN')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all cursor-pointer',
              currentLanguage === 'EN'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            EN
          </button>
        </div>
      </div>
    </Card>
  )
}

export function MissedCallTextBackCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { canManageOrganizationSettings } = useOrgRole()
  const isReadOnly = !canManageOrganizationSettings

  const { data, isLoading } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const mutation = useMutation({
    mutationFn: (enabled: boolean) => api.orgSettings.update({ missedCallTextBack: enabled }),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
    },
  })

  const isEnabled = data?.missedCallTextBack ?? false
  const isDisabled = isReadOnly || isLoading || mutation.isPending
  const switchTitle = isReadOnly
    ? t('settings.missedCallTextBackAdminOnly')
    : t('settings.missedCallTextBack')
  const toggleTextBack = () => {
    if (isReadOnly) return
    mutation.mutate(!isEnabled)
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
            <PhoneMissed className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">{t('settings.missedCallTextBack')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('settings.missedCallTextBackDescription')}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {isReadOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              {t('settings.adminOnly')}
            </span>
          )}
          <button
            type="button"
            role="switch"
            aria-checked={isEnabled}
            aria-label={t('settings.missedCallTextBack')}
            title={switchTitle}
            onClick={toggleTextBack}
            disabled={isDisabled}
            className={cn(
              'relative w-11 h-6 rounded-full transition-colors',
              isReadOnly ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
              isEnabled ? 'bg-primary' : 'bg-muted-foreground/30'
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform',
                isEnabled && 'translate-x-5'
              )}
            />
          </button>
        </div>
      </div>
    </Card>
  )
}
