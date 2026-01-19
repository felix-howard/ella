/**
 * Settings Page - User preferences and app configuration
 * Contains theme toggle and admin configuration tabs
 */

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Sun, Moon, ClipboardList, HelpCircle, FileText, Palette } from 'lucide-react'
import { PageContainer } from '../components/layout'
import { Card } from '@ella/ui'
import { UI_TEXT } from '../lib/constants'
import { useTheme, type Theme } from '../stores/ui-store'
import { cn } from '@ella/ui'
import {
  ChecklistConfigTab,
  IntakeQuestionsConfigTab,
  DocLibraryConfigTab,
} from '../components/settings'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

type SettingsTab = 'appearance' | 'checklist' | 'questions' | 'doc-library'

const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'appearance', label: 'Giao diện', icon: <Palette className="w-4 h-4" /> },
  { id: 'checklist', label: 'Checklist', icon: <ClipboardList className="w-4 h-4" /> },
  { id: 'questions', label: 'Câu hỏi Intake', icon: <HelpCircle className="w-4 h-4" /> },
  { id: 'doc-library', label: 'Thư viện tài liệu', icon: <FileText className="w-4 h-4" /> },
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
      <h2 className="text-lg font-semibold text-foreground mb-4">{settings.appearance}</h2>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-muted-foreground mb-3 block">
            {settings.theme}
          </label>

          <div className="flex gap-3">
            <ThemeButton
              theme="light"
              currentTheme={theme}
              onClick={() => setTheme('light')}
              icon={<Sun className="w-5 h-5" />}
              label={settings.lightMode}
            />
            <ThemeButton
              theme="dark"
              currentTheme={theme}
              onClick={() => setTheme('dark')}
              icon={<Moon className="w-5 h-5" />}
              label={settings.darkMode}
            />
          </div>
        </div>
      </div>
    </Card>
  )
}

interface ThemeButtonProps {
  theme: Theme
  currentTheme: Theme
  onClick: () => void
  icon: React.ReactNode
  label: string
}

function ThemeButton({ theme, currentTheme, onClick, icon, label }: ThemeButtonProps) {
  const isActive = theme === currentTheme

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all min-w-[100px]',
        isActive
          ? 'border-primary bg-primary-light text-primary'
          : 'border-border bg-card text-muted-foreground hover:border-primary/50 hover:text-foreground'
      )}
    >
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </button>
  )
}
