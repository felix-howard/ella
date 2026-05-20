import {
  Building2,
  ClipboardCheck,
  FileText,
  Link2,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { ActivityCategory } from '../../lib/api-client'

export const ACTIVITY_CATEGORY_OPTIONS: ActivityCategory[] = [
  'CLIENT',
  'CASE',
  'DOCUMENT',
  'MESSAGE',
  'PROFILE',
  'SETTINGS',
  'TEAM',
  'LEAD',
  'UPLOAD_LINK',
  'AUTH',
  'SYSTEM',
]

type ActivityIconConfig = {
  icon: LucideIcon
  className: string
}

export const activityIconConfig: Record<ActivityCategory, ActivityIconConfig> = {
  CLIENT: { icon: User, className: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
  CASE: { icon: ClipboardCheck, className: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  DOCUMENT: { icon: FileText, className: 'text-violet-600 bg-violet-500/10 border-violet-500/20' },
  MESSAGE: { icon: MessageSquare, className: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
  PROFILE: { icon: ShieldCheck, className: 'text-cyan-600 bg-cyan-500/10 border-cyan-500/20' },
  SETTINGS: { icon: Settings, className: 'text-slate-600 bg-slate-500/10 border-slate-500/20' },
  TEAM: { icon: Users, className: 'text-indigo-600 bg-indigo-500/10 border-indigo-500/20' },
  LEAD: { icon: Building2, className: 'text-pink-600 bg-pink-500/10 border-pink-500/20' },
  UPLOAD_LINK: { icon: Link2, className: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
  AUTH: { icon: LockKeyhole, className: 'text-rose-600 bg-rose-500/10 border-rose-500/20' },
  SYSTEM: { icon: RefreshCw, className: 'text-muted-foreground bg-muted border-border' },
}

export function getActivityIconConfig(category: ActivityCategory): ActivityIconConfig {
  return activityIconConfig[category] ?? activityIconConfig.SYSTEM
}
