/**
 * Settings Page - User preferences and app configuration
 * Contains theme toggle, language switcher, and admin configuration tabs
 */

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Sun, Moon, Palette, MessageSquare, Globe } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PageContainer } from '../components/layout'
import { Card } from '@ella/ui'
import { useTheme, type Theme } from '../stores/ui-store'
import { cn } from '@ella/ui'
import { useLanguageSync } from '../hooks/use-language-sync'
import type { Language } from '../lib/api-client'
import {
  MessageTemplateConfigTab,
} from '../components/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

type SettingsTab = 'appearance' | 'message-templates'

function SettingsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const { theme, setTheme } = useTheme()
  const { currentLanguage, changeLanguage } = useLanguageSync()

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'appearance', label: t('settings.appearance'), icon: <Palette className="w-4 h-4" /> },
    { id: 'message-templates', label: t('settings.messageTemplates'), icon: <MessageSquare className="w-4 h-4" /> },
  ]

  return (
    <PageContainer>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">{t('settings.title')}</h1>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-border mb-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'appearance' && (
          <div className="space-y-4">
            <ThemeCard theme={theme} setTheme={setTheme} />
            <LanguageCard currentLanguage={currentLanguage} changeLanguage={changeLanguage} />
          </div>
        )}
        {activeTab === 'message-templates' && <MessageTemplateConfigTab />}
      </div>
    </PageContainer>
  )
}

function ThemeCard({ theme, setTheme }: { theme: Theme; setTheme: (t: Theme) => void }) {
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
              'p-2 rounded-full transition-all',
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
              'p-2 rounded-full transition-all',
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

function LanguageCard({ currentLanguage, changeLanguage }: { currentLanguage: Language; changeLanguage: (lang: Language) => void }) {
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
              {currentLanguage === 'VI' ? 'Tiếng Việt' : 'English'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 p-1 rounded-full bg-muted dark:bg-background">
          <button
            onClick={() => changeLanguage('VI')}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
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
              'px-3 py-1.5 rounded-full text-sm font-medium transition-all',
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
