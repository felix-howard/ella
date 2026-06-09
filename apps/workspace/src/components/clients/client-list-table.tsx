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
import { formatPhone, maskPhone, getInitials, getAvatarColor, formatShortRelativeTime } from '../../lib/formatters'
import { ActionBadge } from './action-badge'
import type { ClientWithActions, StaffManagerSummary } from '../../lib/api-client'

interface ClientListTableProps {
  clients: ClientWithActions[]
  isLoading?: boolean
  /** ADMIN + MANAGER — shows Managed-By column */
  canManageClients?: boolean
  /** ADMIN only — full phone display (server masks for others; this is defense-in-depth) */
  canViewPhone?: boolean
}

/** Row entry with grouping metadata */
interface GroupedRow {
  client: ClientWithActions
  isGroupedBusiness: boolean
  ownerName?: string
}

/**
 * Group clients by clientGroupId: individual first, then businesses indented below.
 * Groups appear at the position of their first member in the original API order.
 */
function groupClients(clients: ClientWithActions[]): GroupedRow[] {
  const groups = new Map<string, ClientWithActions[]>()
  const seen = new Set<string>()
  const result: GroupedRow[] = []

  // Collect groups
  for (const client of clients) {
    if (client.clientGroupId) {
      const group = groups.get(client.clientGroupId) || []
      group.push(client)
      groups.set(client.clientGroupId, group)
    }
  }

  // Sort each group: INDIVIDUAL first, then BUSINESS
  for (const group of groups.values()) {
    group.sort((a, b) => {
      if (a.clientType === b.clientType) return 0
      return a.clientType === 'INDIVIDUAL' ? -1 : 1
    })
  }

  // Walk original order; when first member of a group is encountered, emit entire group
  for (const client of clients) {
    if (seen.has(client.id)) continue

    if (client.clientGroupId && groups.has(client.clientGroupId)) {
      const group = groups.get(client.clientGroupId)!
      const ownerName = group.find(c => c.clientType === 'INDIVIDUAL')?.name
      // Only treat as a parent/child group if an INDIVIDUAL anchor is present.
      // When individuals are filtered out (e.g. "Businesses" tab), render all
      // businesses as peers instead of nesting the 2nd+ under the 1st.
      const hasIndividualAnchor = !!ownerName
      for (let i = 0; i < group.length; i++) {
        const member = group[i]
        seen.add(member.id)
        const isNested = hasIndividualAnchor && i > 0 && member.clientType === 'BUSINESS'
        result.push({
          client: member,
          isGroupedBusiness: isNested,
          ownerName: isNested ? ownerName : undefined,
        })
      }
    } else {
      seen.add(client.id)
      result.push({ client, isGroupedBusiness: false })
    }
  }

  return result
}

export function ClientListTable({ clients, isLoading, canManageClients, canViewPhone }: ClientListTableProps) {
  const { t } = useTranslation()

  const groupedRows = useMemo(() => groupClients(clients), [clients])

  if (isLoading) {
    return <ClientListTableSkeleton canManageClients={canManageClients} />
  }

  if (clients.length === 0) {
    return <EmptyState />
  }

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/50">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.clientName}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.phone}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.taxYear}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                {t('clients.tags')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                {t('clients.documents')}
              </th>
              {canManageClients && (
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  {t('team.managedBy')}
                </th>
              )}
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                {t('clients.created')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {t('clients.uploads')}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {t('clients.tasks')}
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((row, index) => (
              <ClientRow
                key={row.client.id}
                client={row.client}
                isLast={index === groupedRows.length - 1}
                canManageClients={canManageClients}
                canViewPhone={canViewPhone}
                isGroupedBusiness={row.isGroupedBusiness}
                ownerName={row.ownerName}
              />
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
  canManageClients?: boolean
  canViewPhone?: boolean
  isGroupedBusiness?: boolean
  ownerName?: string
}

const ClientRow = memo(function ClientRow({ client, isLast, canManageClients, canViewPhone, isGroupedBusiness, ownerName }: ClientRowProps) {
  const { t, i18n } = useTranslation()
  const { computedStatus, actionCounts, latestCase, uploads } = client
  const isBusiness = client.clientType === 'BUSINESS'
  // Memoize avatar colors to prevent recalculation on every render
  const avatarColor = useMemo(() => getAvatarColor(client.name), [client.name])
  const managers = useMemo(
    () => client.managedByStaff && client.managedByStaff.length > 0
      ? client.managedByStaff
      : client.managedBy
        ? [client.managedBy]
        : [],
    [client.managedByStaff, client.managedBy]
  )

  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: client.id }}
      className={cn(
        'table-row hover:bg-muted/40 transition-colors duration-150 cursor-pointer',
        !isLast && 'border-b border-border/40',
        isGroupedBusiness && 'bg-muted/40'
      )}
    >
      {/* Name column */}
      <td className="px-4 py-3 align-middle">
        <div className={cn('flex items-center gap-3', isGroupedBusiness && 'pl-4 sm:pl-8')}>
          {/* Connector for grouped business */}
          {isGroupedBusiness && (
            <span className="text-muted-foreground/50 text-sm hidden sm:inline" aria-hidden="true">└</span>
          )}
          {/* Avatar: rounded-square for business, circle for individual */}
          <div className={cn(
            'w-9 h-9 flex items-center justify-center flex-shrink-0 ring-2 ring-background shadow-sm',
            isBusiness ? 'rounded-lg' : 'rounded-full',
            avatarColor.bg,
            avatarColor.text
          )}>
            <span className="font-semibold text-sm">
              {getInitials(client.name)}
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground truncate">{client.name}</p>
              {isBusiness && client.businessType && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide bg-muted text-muted-foreground border border-border/60 whitespace-nowrap">
                  {t(`clients.businessType.${client.businessType}`, client.businessType)}
                </span>
              )}
            </div>
            {isGroupedBusiness && ownerName ? (
              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                {t('clients.linkedTo', { name: ownerName })}
              </p>
            ) : client.email ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Mail className="w-3 h-3" aria-hidden="true" />
                {client.email}
              </p>
            ) : null}
          </div>
        </div>
      </td>

      {/* Phone column */}
      <td className="px-4 py-3 whitespace-nowrap align-middle">
        <span className="text-muted-foreground">{canViewPhone ? formatPhone(client.phone) : maskPhone(client.phone)}</span>
      </td>

      {/* Tax Year column */}
      <td className="px-4 py-3 align-middle">
        {latestCase ? (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{latestCase.taxYear}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Tags column */}
      <td className="px-4 py-3 hidden sm:table-cell align-middle">
        <div className="flex flex-wrap gap-1">
          {client.tags && client.tags.length > 0 ? (
            client.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground"
              >
                {tag}
              </span>
            ))
          ) : (
            <SourceBadge source={client.source} />
          )}
        </div>
      </td>

      {/* Documents column */}
      <td className="px-4 py-3 hidden lg:table-cell align-middle">
        {uploads && uploads.totalCount > 0 ? (
          <div className="flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
            <span className="font-medium">{uploads.totalCount}</span>
          </div>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </td>

      {/* Managed by column (admin/manager only) */}
      {canManageClients && (
        <td className="px-4 py-3 align-middle">
          {managers.length > 0 ? (
            <ManagerCell managers={managers} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}

      {/* Created column */}
      <td className="px-4 py-3 hidden lg:table-cell align-middle">
        <span className="text-sm text-muted-foreground">
          {formatShortRelativeTime(client.createdAt, i18n.language)}
        </span>
      </td>

      {/* Uploads column (combined: new count + last upload time) */}
      <td className="px-4 py-3 hidden md:table-cell align-middle">
        {uploads && (uploads.newCount > 0 || uploads.latestAt) ? (
          <div className="flex items-center gap-2">
            {uploads.newCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-muted text-muted-foreground">
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                {t('clients.newUploads', { count: uploads.newCount })}
              </span>
            )}
            {uploads.latestAt && (
              <span className="text-xs text-muted-foreground">
                {formatShortRelativeTime(uploads.latestAt, i18n.language)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Action badges column */}
      <td className="px-4 py-3 hidden md:table-cell align-middle">
        <div className="flex flex-wrap gap-1 max-w-[200px]">
          {!client.hasUploadLink && client.clientType === 'INDIVIDUAL' && ['FORM', 'GENERIC_FORM', 'STAFF_FORM', 'INCOMING_SMS', 'INCOMING_CALL'].includes(client.source) && (
            <ActionBadge type="need-upload-link" />
          )}
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
      <td className="px-4 py-3 align-middle">
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </td>
    </Link>
  )
})

function EmptyState() {
  return (
    <div className="bg-card rounded-xl shadow-sm p-12 text-center">
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

function SourceBadge({ source }: { source?: string }) {
  const { t } = useTranslation()

  const config: Record<string, { className: string; label: string }> = {
    FORM: { className: 'bg-primary/10 text-primary', label: t('clients.sourceForm') },
    GENERIC_FORM: { className: 'bg-primary/10 text-primary', label: t('clients.sourceGenericForm') },
    STAFF_FORM: { className: 'bg-blue-500/10 text-blue-600', label: t('clients.sourceStaffForm') },
    CONVERTED: { className: 'bg-emerald-500/10 text-emerald-600', label: t('clients.sourceConverted') },
    INCOMING_SMS: { className: 'bg-violet-500/10 text-violet-600', label: t('clients.sourceIncomingSms') },
    INCOMING_CALL: { className: 'bg-orange-500/10 text-orange-600', label: t('clients.sourceIncomingCall') },
    MANUAL: { className: 'bg-muted text-muted-foreground', label: t('clients.sourceManual') },
  }

  const { className, label } = config[source ?? 'MANUAL'] ?? config.MANUAL

  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', className)}>
      {label}
    </span>
  )
}

function ManagerCell({ managers }: { managers: StaffManagerSummary[] }) {
  const names = managers.map((manager) => manager.name).join(', ')

  return (
    <div className="flex min-w-[180px] max-w-[300px] flex-wrap items-center gap-1.5" title={names}>
      {managers.map((manager) => (
        <span
          key={manager.id}
          className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted/70 px-2 py-1 text-sm font-medium text-foreground"
        >
          <ManagerAvatar manager={manager} />
          <span className="min-w-0 whitespace-normal break-words leading-snug">
            {manager.name}
          </span>
        </span>
      ))}
    </div>
  )
}

function ManagerAvatar({ manager }: { manager: StaffManagerSummary }) {
  const avatarColor = getAvatarColor(manager.name)

  if (manager.avatarUrl) {
    return (
      <img
        src={manager.avatarUrl}
        alt={manager.name}
        className="h-6 w-6 flex-shrink-0 rounded-full object-cover ring-2 ring-card"
      />
    )
  }

  return (
    <div className={cn(
      'h-6 w-6 flex-shrink-0 rounded-full ring-2 ring-card flex items-center justify-center',
      avatarColor.bg,
      avatarColor.text
    )}>
      <span className="text-[10px] font-semibold">
        {getInitials(manager.name)}
      </span>
    </div>
  )
}

/**
 * Skeleton loader for table - accepts canManageClients to match live table column layout
 */
export function ClientListTableSkeleton({ canManageClients }: { canManageClients?: boolean }) {
  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/50 bg-muted/50">
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden sm:table-cell">
                <div className="h-4 w-14 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              {canManageClients && (
                <th className="text-left font-medium text-muted-foreground px-4 py-3">
                  <div className="h-4 w-[150px] bg-muted rounded animate-pulse" />
                </th>
              )}
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-24 bg-muted rounded animate-pulse" />
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-border/40">
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
                <td className="px-4 py-3 hidden sm:table-cell">
                  <div className="h-5 w-14 bg-muted rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </td>
                {canManageClients && (
                  <td className="px-4 py-3">
                    <div className="h-4 w-[150px] bg-muted rounded animate-pulse" />
                  </td>
                )}
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="h-4 w-16 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="h-5 w-24 bg-muted rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
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
