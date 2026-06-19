/**
 * Settings Page - Tabbed layout with General, Notifications, and Form Links
 * Uses URL search params for tab state so tabs are bookmarkable
 */
import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Settings, Bell, Link as LinkIcon } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ella/ui'
import { PageContainer } from '../components/layout'
import { SettingsGeneralTab } from '../components/settings/settings-general-tab'
import { SettingsNotificationsTab } from '../components/settings/settings-notifications-tab'
import { SettingsFormLinksTab } from '../components/settings/settings-form-links-tab'

type SettingsTab =
  | 'general'
  | 'notifications'
  | 'form-links'

const VALID_TABS: SettingsTab[] = [
  'general',
  'notifications',
  'form-links',
]

/** Section ids that the NDA wizard's "Set up" deep links target. */
const VALID_FOCUS = ['firm-info'] as const
type SettingsFocus = (typeof VALID_FOCUS)[number]

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab; focus?: SettingsFocus } => {
    const tab = search.tab as string
    const focus = search.focus as string
    return {
      tab: VALID_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined,
      focus: VALID_FOCUS.includes(focus as SettingsFocus) ? (focus as SettingsFocus) : undefined,
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  const { tab, focus } = Route.useSearch()
  const navigate = useNavigate()
  const activeTab = tab || 'general'

  const handleTabChange = (value: string) => {
    navigate({
      to: '/settings',
      search: value === 'general' ? {} : { tab: value as SettingsTab },
      replace: true,
    })
  }

  // Scroll the focused section into view + apply a brief highlight pulse so
  // CPAs landing here from the NDA setup card can find what they need.
  useEffect(() => {
    if (!focus) return
    // Defer to next frame so the target tab content has mounted.
    const id = window.requestAnimationFrame(() => {
      const el = document.querySelector(`[data-settings-focus="${focus}"]`)
      if (!el) return
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      const ringClasses = ['ring-2', 'ring-primary', 'ring-offset-2']
      el.classList.add(...ringClasses)
      window.setTimeout(() => {
        el.classList.remove(...ringClasses)
      }, 2000)
    })
    return () => window.cancelAnimationFrame(id)
  }, [focus, activeTab])

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
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              {t('settings.tabNotifications')}
            </TabsTrigger>
            <TabsTrigger value="form-links" className="flex items-center gap-2">
              <LinkIcon className="w-4 h-4" />
              {t('settings.tabFormLinks')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <SettingsGeneralTab />
          </TabsContent>

          <TabsContent value="notifications">
            <SettingsNotificationsTab />
          </TabsContent>

          <TabsContent value="form-links">
            <SettingsFormLinksTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
