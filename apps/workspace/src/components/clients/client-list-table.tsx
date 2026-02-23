/**
 * Client List Table Component - Table view of clients
 * Displays clients with computed status and action badges
 */

import { memo, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Mail, Calendar, ChevronRight, Users, FileText } from 'lucide-react'
import { cn } from '@ella/ui'
import { UI_TEXT } from '../../lib/constants'
import { formatPhone, getInitials, getAvatarColor, formatRelativeTime } from '../../lib/formatters'
import { useOrgRole } from '../../hooks/use-org-role'
import { ActionBadge } from './action-badge'
import type { ClientWithActions } from '../../lib/api-client'

interface ClientListTableProps {
  clients: ClientWithActions[]
  isLoading?: boolean
}

export function ClientListTable({ clients, isLoading }: ClientListTableProps) {
  const { t } = useTranslation()
  const { isAdmin } = useOrgRole()

  if (isLoading) {
    return <ClientListTableSkeleton isAdmin={isAdmin} />
  }

  if (clients.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.clientName}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.phone}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.taxYear}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                {t('clients.documents')}
              </th>
              {isAdmin && (
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                  {t('team.assignedTo')}
                </th>
              )}
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {t('clients.uploads')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {t('clients.lastUpload')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {t('clients.tasks')}
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <ClientRow key={client.id} client={client} isLast={index === clients.length - 1} isAdmin={isAdmin} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface ClientRowProps {
  client: ClientWithActions
  isLast: boolean
  isAdmin: boolean
}

const ClientRow = memo(function ClientRow({ client, isLast, isAdmin }: ClientRowProps) {
  const { t, i18n } = useTranslation()
  const { computedStatus, actionCounts, latestCase, uploads } = client
  // Memoize avatar color to prevent recalculation on every render
  const avatarColor = useMemo(() => getAvatarColor(client.name), [client.name])

  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: client.id }}
      className={cn(
        'table-row hover:bg-muted/50 transition-colors cursor-pointer',
        !isLast && 'border-b border-border'
      )}
    >
      {/* Name column */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={cn(
            'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
            avatarColor.bg,
            avatarColor.text
          )}>
            <span className="font-semibold text-sm">
              {getInitials(client.name)}
            </span>
          </div>
          <div>
            <p className="font-medium text-foreground">{client.name}</p>
            {client.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" aria-hidden="true" />
                {client.email}
              </p>
            )}
          </div>
        </div>
      </td>

      {/* Phone column */}
      <td className="px-4 py-3">
        <span className="text-muted-foreground">{formatPhone(client.phone)}</span>
      </td>

      {/* Tax Year column */}
      <td className="px-4 py-3">
        {latestCase ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{latestCase.taxYear}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Documents column */}
      <td className="px-4 py-3 hidden lg:table-cell">
        {uploads && uploads.totalCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{uploads.totalCount}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>

      {/* Assigned to column - admin only */}
      {isAdmin && (
        <td className="px-4 py-3 hidden lg:table-cell">
          {client.assignedStaff && client.assignedStaff.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {client.assignedStaff.map((staff) => (
                <span
                  key={staff.id}
                  className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full"
                >
                  {staff.name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}

      {/* Uploads column */}
      <td className="px-4 py-3 hidden md:table-cell">
        {uploads && uploads.newCount > 0 ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {t('clients.newUploads', { count: uploads.newCount })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Last Upload column */}
      <td className="px-4 py-3 hidden md:table-cell">
        {uploads?.latestAt ? (
          <span className="text-sm text-muted-foreground">
            {formatRelativeTime(uploads.latestAt, i18n.language as 'en' | 'vi')}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Action badges column */}
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {actionCounts?.hasNewActivity && (
            <ActionBadge type="new-activity" />
          )}
          {actionCounts?.toVerify !== undefined && actionCounts.toVerify > 0 && (
            <ActionBadge type="verify" count={actionCounts.toVerify} />
          )}
          {actionCounts?.toEnter !== undefined && actionCounts.toEnter > 0 && (
            <ActionBadge type="entry" count={actionCounts.toEnter} />
          )}
          {actionCounts?.staleDays !== null && actionCounts?.staleDays !== undefined && (
            <ActionBadge type="stale" days={actionCounts.staleDays} />
          )}
          {computedStatus === 'ENTRY_COMPLETE' && (
            <ActionBadge type="ready" />
          )}
        </div>
      </td>

      {/* Arrow column */}
      <td className="px-4 py-3">
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </td>
    </Link>
  )
})

function EmptyState() {
  return (
    <div className="bg-card rounded-xl border border-border p-12 text-center">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
        <Users className="w-8 h-8 text-muted-foreground" aria-hidden="true" />
      </div>
      <h3 className="font-medium text-foreground mb-1">{UI_TEXT.clients.noClients}</h3>
      <p className="text-sm text-muted-foreground">
        {UI_TEXT.clients.noClientsHint}
      </p>
    </div>
  )
}

/**
 * Skeleton loader for table - accepts isAdmin to match live table column layout
 */
export function ClientListTableSkeleton({ isAdmin = false }: { isAdmin?: boolean }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              {isAdmin && (
                <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </th>
              )}
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-muted animate-pulse" />
                    <div>
                      <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-36 bg-muted rounded animate-pulse mt-1.5" />
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 hidden lg:table-cell">
                    <div className="flex gap-1">
                      <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                    </div>
                  </td>
                )}
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="h-5 w-24 bg-muted rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <div className="h-5 w-14 bg-muted rounded-full animate-pulse" />
                    <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-4 bg-muted rounded animate-pulse" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
