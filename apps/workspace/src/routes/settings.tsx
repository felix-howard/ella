/**
 * Settings Page - Tabbed layout split by account vs organization scope
 * Uses URL search params for tab state so tabs are bookmarkable
 */
import { useEffect } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Building2, UserCog } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@ella/ui'
import { PageContainer } from '../components/layout'
import { SettingsAccountTab } from '../components/settings/settings-account-tab'
import { SettingsOrganizationTab } from '../components/settings/settings-organization-tab'

type SettingsTab =
  | 'account'
  | 'organization'

const VALID_TABS: SettingsTab[] = [
  'account',
  'organization',
]

/** Section ids that the NDA wizard's "Set up" deep links target. */
const VALID_FOCUS = ['firm-info'] as const
type SettingsFocus = (typeof VALID_FOCUS)[number]

function normalizeTab(tab: unknown): SettingsTab | undefined {
  if (tab === 'general' || tab === 'notifications') return 'account'
  if (tab === 'form-links') return 'organization'
  return VALID_TABS.includes(tab as SettingsTab) ? (tab as SettingsTab) : undefined
}

export const Route = createFileRoute('/settings')({
  validateSearch: (search: Record<string, unknown>): { tab?: SettingsTab; focus?: SettingsFocus } => {
    const focus = search.focus as string
    return {
      tab: normalizeTab(search.tab),
      focus: VALID_FOCUS.includes(focus as SettingsFocus) ? (focus as SettingsFocus) : undefined,
    }
  },
  component: SettingsPage,
})

function SettingsPage() {
  const { t } = useTranslation()
  const { tab, focus } = Route.useSearch()
  const navigate = useNavigate()
  const activeTab = tab || (focus ? 'organization' : 'account')

  const handleTabChange = (value: string) => {
    navigate({
      to: '/settings',
      search: value === 'account' ? {} : { tab: value as SettingsTab },
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

        <Tabs defaultValue="account" value={activeTab} onValueChange={handleTabChange} variant="underline">
          <TabsList className="w-full">
            <TabsTrigger value="account" className="flex items-center gap-2">
              <UserCog className="w-4 h-4" />
              {t('settings.tabMySettings')}
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {t('settings.tabOrganization')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <SettingsAccountTab />
          </TabsContent>

          <TabsContent value="organization">
            <SettingsOrganizationTab />
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  )
}
