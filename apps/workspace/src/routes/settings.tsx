/**
 * Settings Page - Tabbed layout with General, Profile, Notifications, and Form Links
 * Uses URL search params for tab state so tabs are bookmarkable
 */
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Settings, User, Bell, Link as LinkIcon, FileSignature } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ella/ui'
import { PageContainer } from '../components/layout'
import { SettingsGeneralTab } from '../components/settings/settings-general-tab'
import { SettingsProfileTab } from '../components/settings/settings-profile-tab'
import { SettingsNotificationsTab } from '../components/settings/settings-notifications-tab'
import { SettingsFormLinksTab } from '../components/settings/settings-form-links-tab'
import { SettingsAgreementTemplatesTab } from '../components/settings/settings-agreement-templates-tab'
import { useOrgRole } from '../hooks/use-org-role'

type SettingsTab =
  | 'general'
  | 'profile'
  | 'notifications'
  | 'form-links'
  | 'agreement-templates'

const VALID_TABS: SettingsTab[] = [
  'general',
  'profile',
  'notifications',
  'form-links',
  'agreement-templates',
]

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab } => {
    const tab = search.tab as string
    return {
      tab: VALID_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined,
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  const { tab } = Route.useSearch()
  const navigate = useNavigate()
  const { isAdmin } = useOrgRole()
  const activeTab = tab || 'general'

  const handleTabChange = (value: string) => {
    navigate({
      to: '/settings',
      search: value === 'general' ? {} : { tab: value as SettingsTab },
      replace: true,
    })
  }

  return (
    <PageContainer>
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t('settings.title')}</h1>

        <Tabs defaultValue="general" value={activeTab} onValueChange={handleTabChange} variant="underline">
          <TabsList className="w-full">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              {t('settings.tabGeneral')}
            </TabsTrigger>
            <TabsTrigger value="profile" className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {t('settings.tabProfile')}
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t('settings.tabNotifications')}
            </TabsTrigger>
            <TabsTrigger value="form-links" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              {t('settings.tabFormLinks')}
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="agreement-templates" className="flex items-center gap-2">
                <FileSignature className="w-4 h-4" />
                {t('settings.tabAgreementTemplates')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="general">
            <SettingsGeneralTab />
          </TabsContent>

          <TabsContent value="profile">
            <SettingsProfileTab />
          </TabsContent>

          <TabsContent value="notifications">
            <SettingsNotificationsTab />
          </TabsContent>

          <TabsContent value="form-links">
            <SettingsFormLinksTab />
          </TabsContent>

          <TabsContent value="agreement-templates">
            <SettingsAgreementTemplatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
