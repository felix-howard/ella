/**
 * Settings Page - User preferences and app configuration
 * Contains theme toggle and admin configuration tabs
 */

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Sun, Moon, Palette, MessageSquare } from 'lucide-react'
import { PageContainer } from '../components/layout'
import { Card } from '@ella/ui'
import { UI_TEXT } from '../lib/constants'
import { useTheme, type Theme } from '../stores/ui-store'
import { cn } from '@ella/ui'
import {
  ChecklistConfigTab,
  IntakeQuestionsConfigTab,
  DocLibraryConfigTab,
  MessageTemplateConfigTab,
} from '../components/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

type SettingsTab = 'appearance' | 'checklist' | 'questions' | 'doc-library' | 'message-templates'

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Giao diện', icon: <Palette className="w-4 h-4" /> },
  // Temporarily hidden - uncomment when ready
  // { id: 'checklist', label: 'Checklist', icon: <ClipboardList className="w-4 h-4" /> },
  // { id: 'questions', label: 'Câu hỏi Intake', icon: <HelpCircle className="w-4 h-4" /> },
  // { id: 'doc-library', label: 'Thư viện tài liệu', icon: <FileText className="w-4 h-4" /> },
  { id: 'message-templates', label: 'Mẫu tin nhắn', icon: <MessageSquare className="w-4 h-4" /> },
]

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance')
  const { theme, setTheme } = useTheme()
  const { settings } = UI_TEXT

  return (
    <PageContainer>
      <div className="max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">{settings.title}</h1>

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
          <AppearanceTab theme={theme} setTheme={setTheme} settings={settings} />
        )}
        {activeTab === 'checklist' && <ChecklistConfigTab />}
        {activeTab === 'questions' && <IntakeQuestionsConfigTab />}
        {activeTab === 'doc-library' && <DocLibraryConfigTab />}
        {activeTab === 'message-templates' && <MessageTemplateConfigTab />}
      </div>
    </PageContainer>
  )
}

interface AppearanceTabProps {
  theme: Theme
  setTheme: (theme: Theme) => void
  settings: typeof UI_TEXT.settings
}

function AppearanceTab({ theme, setTheme, settings }: AppearanceTabProps) {
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
            <h3 className="text-sm font-medium text-foreground">{settings.theme}</h3>
            <p className="text-xs text-muted-foreground">
              {theme === 'dark' ? settings.darkMode : settings.lightMode}
            </p>
          </div>
        </div>

        {/* Toggle Switch - use bg-background in dark mode for contrast since bg-muted equals bg-card */}
        <div className="flex items-center gap-2 p-1 rounded-full bg-muted dark:bg-background">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              'p-2 rounded-full transition-all',
              theme === 'light'
                ? 'bg-card text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title={settings.lightMode}
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
            title={settings.darkMode}
          >
            <Moon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </Card>
  )
}
