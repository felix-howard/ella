import { useTranslation } from 'react-i18next'
import { FirmInfoCard } from './firm-info-card'
import { MissedCallTextBackCard } from './settings-general-tab'
import { SettingsFormLinksTab } from './settings-form-links-tab'
import { SettingsScopeHeader } from './settings-scope-header'

export function SettingsOrganizationTab() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <SettingsScopeHeader
        title={t('settings.organizationScopeTitle')}
        description={t('settings.organizationScopeDescription')}
        badge={t('settings.organizationScopeBadge')}
      />
      <FirmInfoCard />
      <SettingsFormLinksTab />
      <MissedCallTextBackCard />
    </div>
  )
}
