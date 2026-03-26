/**
 * Client Meta Info - Shows created/updated audit metadata
 */
import { useTranslation } from 'react-i18next'
import { CalendarDays } from 'lucide-react'

interface ClientMetaInfoProps {
  createdAt: string
  updatedAt: string
  createdBy?: { id: string; name: string } | null
  updatedBy?: { id: string; name: string } | null
}

export function ClientMetaInfo({ createdAt, updatedAt, createdBy, updatedBy }: ClientMetaInfoProps) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language?.toLowerCase().startsWith('en') ? 'en-US' : 'vi-VN'

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <MetaItem
          label={t('clients.meta.created')}
          date={formatDate(createdAt)}
          staffName={createdBy?.name}
          t={t}
        />
        <MetaItem
          label={t('clients.meta.lastUpdated')}
          date={formatDate(updatedAt)}
          staffName={updatedBy?.name}
          t={t}
        />
      </div>
    </div>
  )
}

function MetaItem({ label, date, staffName, t }: {
  label: string
  date: string
  staffName?: string
  t: (key: string, opts?: Record<string, string>) => string
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
        <CalendarDays className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium text-foreground">{date}</p>
        {staffName ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('clients.meta.by', { name: staffName })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-0.5">—</p>
        )}
      </div>
    </div>
  )
}
