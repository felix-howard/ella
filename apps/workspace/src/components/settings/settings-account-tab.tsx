import { useTranslation } from 'react-i18next'
import { useTheme } from '../../stores/ui-store'
import { useLanguageSync } from '../../hooks/use-language-sync'
import { SettingsNotificationsTab } from './settings-notifications-tab'
import { LanguageCard, ThemeCard } from './settings-general-tab'
import { SettingsScopeHeader } from './settings-scope-header'

export function SettingsAccountTab() {
  const { t } = useTranslation()
  const { theme, setTheme } = useTheme()
  const { currentLanguage, changeLanguage } = useLanguageSync()

  return (
    <div className="space-y-4">
      <SettingsScopeHeader
        title={t('settings.accountScopeTitle')}
        description={t('settings.accountScopeDescription')}
        badge={t('settings.accountScopeBadge')}
      />
      <ThemeCard theme={theme} setTheme={setTheme} />
      <LanguageCard currentLanguage={currentLanguage} changeLanguage={changeLanguage} />
      <SettingsNotificationsTab />
    </div>
  )
}
