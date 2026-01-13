/**
 * Quick Actions Component - Dashboard action buttons grid
 * Provides shortcuts to common staff tasks
 */

import { Link } from '@tanstack/react-router'
import {
  Users,
  CheckSquare,
  FileText,
  AlertTriangle,
  type LucideIcon,
} from 'lucide-react'
import { UI_TEXT } from '../../lib/constants'

interface QuickAction {
  icon: LucideIcon
  label: string
  href: string
}

export function QuickActions() {
  const { dashboard, quickAction } = UI_TEXT

  const actions: QuickAction[] = [
    {
      icon: Users,
      label: quickAction.addClient,
      href: '/clients/new',
    },
    {
      icon: CheckSquare,
      label: quickAction.viewActions,
      href: '/actions',
    },
    {
      icon: FileText,
      label: quickAction.verifyDocs,
      href: '/actions?type=VERIFY_DOCS',
    },
    {
      icon: AlertTriangle,
      label: quickAction.handleBlurry,
      href: '/actions?type=BLURRY_DETECTED',
    },
  ]

  return (
    <div className="bg-card rounded-xl border border-border p-6 mb-8">
      <h2 className="text-lg font-semibold text-primary mb-4">
        {dashboard.quickActions}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {actions.map((action) => (
          <QuickActionButton key={action.href} {...action} />
        ))}
      </div>
    </div>
  )
}

interface QuickActionButtonProps {
  icon: LucideIcon
  label: string
  href: string
}

function QuickActionButton({ icon: Icon, label, href }: QuickActionButtonProps) {
  return (
    <Link
      to={href as '/'}
      className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:bg-primary-light hover:border-primary transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-sm text-muted-foreground group-hover:text-primary transition-colors text-center">
        {label}
      </span>
    </Link>
  )
}
