/**
 * Settings Page - User preferences and app configuration
 * Contains theme toggle and other settings
 */

import { createFileRoute } from '@tanstack/react-router'
import { Sun, Moon } from 'lucide-react'
import { PageContainer } from '../components/layout'
import { Card } from '@ella/ui'
import { UI_TEXT } from '../lib/constants'
import { useTheme, type Theme } from '../stores/ui-store'
import { cn } from '@ella/ui'

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
})

function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { settings } = UI_TEXT

  return (
    <PageContainer>
      <div className="max-w-2xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">{settings.title}</h1>

        {/* Appearance Section */}
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
      </div>
    </PageContainer>
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
