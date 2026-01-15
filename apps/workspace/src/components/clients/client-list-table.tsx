/**
 * Client List Table Component - Table view of clients
 * Displays clients in a sortable, paginated table format
 */

import { Link } from '@tanstack/react-router'
import { Phone, Mail, Calendar, ChevronRight, Users } from 'lucide-react'
import { cn } from '@ella/ui'
import {
  CASE_STATUS_LABELS,
  CASE_STATUS_COLORS,
  TAX_TYPE_LABELS,
  LANGUAGE_LABELS,
  UI_TEXT,
} from '../../lib/constants'
import { formatPhone, getInitials, getAvatarColor } from '../../lib/formatters'
import type { Client, TaxCaseStatus } from '../../lib/api-client'

interface ClientListTableProps {
  clients: Client[]
  isLoading?: boolean
}

export function ClientListTable({ clients, isLoading }: ClientListTableProps) {
  if (isLoading) {
    return <ClientListTableSkeleton />
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
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                {UI_TEXT.form.language}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                {UI_TEXT.form.taxYear}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                {UI_TEXT.form.taxTypes}
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                Trạng thái
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((client, index) => (
              <ClientRow key={client.id} client={client} isLast={index === clients.length - 1} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface ClientRowProps {
  client: Client
  isLast: boolean
}

function ClientRow({ client, isLast }: ClientRowProps) {
  const latestCase = client.taxCases?.[0]
  const caseStatus = latestCase?.status as TaxCaseStatus | undefined
  const statusColors = caseStatus ? CASE_STATUS_COLORS[caseStatus] : null
  const statusLabel = caseStatus ? CASE_STATUS_LABELS[caseStatus] : 'Chưa có hồ sơ'
  const avatarColor = getAvatarColor(client.name)

  return (
    <Link
      to="/clients/$clientId"
      params={{ clientId: client.id }}
      className={cn(
        'table-row hover:bg-muted/50 transition-colors cursor-pointer',
        !isLast && 'border-b border-border'
      )}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar */}
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
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{formatPhone(client.phone)}</span>
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="text-muted-foreground">
          {LANGUAGE_LABELS[client.language] || client.language}
        </span>
      </td>
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
      <td className="px-4 py-3 hidden lg:table-cell">
        {latestCase?.taxYear ? (
          <div className="flex flex-wrap gap-1">
            {/* Show tax types if available - mock for now */}
            <span className="text-xs bg-muted px-2 py-0.5 rounded-full text-muted-foreground">
              {TAX_TYPE_LABELS['FORM_1040']}
            </span>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        {statusColors ? (
          <span
            className={cn(
              'text-xs font-medium px-2.5 py-1 rounded-full inline-block',
              statusColors.bg,
              statusColors.text
            )}
          >
            {statusLabel}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <ChevronRight className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
      </td>
    </Link>
  )
}

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
 * Skeleton loader for table
 */
export function ClientListTableSkeleton() {
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
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden md:table-cell">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-16 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3 hidden lg:table-cell">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
              </th>
              <th className="text-left font-medium text-muted-foreground px-4 py-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse" />
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
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="h-4 w-20 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-4 w-12 bg-muted rounded animate-pulse" />
                </td>
                <td className="px-4 py-3 hidden lg:table-cell">
                  <div className="h-5 w-16 bg-muted rounded-full animate-pulse" />
                </td>
                <td className="px-4 py-3">
                  <div className="h-6 w-20 bg-muted rounded-full animate-pulse" />
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

