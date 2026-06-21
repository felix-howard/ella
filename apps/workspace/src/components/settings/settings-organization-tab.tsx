import { useTranslation } from 'react-i18next'
import { FirmInfoCard } from './firm-info-card'
import { MissedCallTextBackCard } from './settings-general-tab'
import { SettingsFormLinksTab } from './settings-form-links-tab'
import { SettingsScopeHeader } from './settings-scope-header'
import { useOrgRole } from '../../hooks/use-org-role'

export function SettingsOrganizationTab() {
  const { t } = useTranslation()
  const { canManageOrganizationSettings } = useOrgRole()
  const scopeDescription = canManageOrganizationSettings
    ? t('settings.organizationScopeDescription')
    : t('settings.organizationScopePersonalDescription')
  const scopeBadge = canManageOrganizationSettings
    ? t('settings.organizationScopeBadge')
    : t('settings.organizationScopePersonalBadge')

  return (
    <div className="space-y-4">
      <SettingsScopeHeader
        title={t('settings.organizationScopeTitle')}
        description={scopeDescription}
        badge={scopeBadge}
      />
      <FirmInfoCard />
      <SettingsFormLinksTab />
      <MissedCallTextBackCard />
    </div>
  )
}
