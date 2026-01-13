/**
 * Kanban Board Component - Visual client management by status
 * Displays clients in columns based on their tax case status
 */

import { useMemo } from 'react'
import { cn } from '@ella/ui'
import { Users } from 'lucide-react'
import { ClientCard, ClientCardSkeleton } from './client-card'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS, UI_TEXT } from '../../lib/constants'
import type { Client, TaxCaseStatus } from '../../lib/api-client'

// Kanban column order - defines display order of status columns
const COLUMN_ORDER: TaxCaseStatus[] = [
  'INTAKE',
  'WAITING_DOCS',
  'IN_PROGRESS',
  'READY_FOR_ENTRY',
  'ENTRY_COMPLETE',
  'REVIEW',
  'FILED',
]

interface KanbanBoardProps {
  clients: Client[]
  isLoading?: boolean
}

interface KanbanColumn {
  status: TaxCaseStatus
  label: string
  clients: Client[]
  colors: { bg: string; text: string; border: string }
}

export function KanbanBoard({ clients, isLoading }: KanbanBoardProps) {
  // Group clients by their latest case status - O(n) performance
  const columns = useMemo<KanbanColumn[]>(() => {
    // Initialize all columns with empty arrays
    const grouped: Record<TaxCaseStatus, Client[]> = {
      INTAKE: [],
      WAITING_DOCS: [],
      IN_PROGRESS: [],
      READY_FOR_ENTRY: [],
      ENTRY_COMPLETE: [],
      REVIEW: [],
      FILED: [],
    }

    // Single pass grouping - O(n)
    for (const client of clients) {
      const latestCase = client.taxCases?.[0]
      const status = (latestCase?.status as TaxCaseStatus) || 'INTAKE'
      grouped[status].push(client)
    }

    return COLUMN_ORDER.map((status) => ({
      status,
      label: CASE_STATUS_LABELS[status] || status,
      clients: grouped[status],
      colors: CASE_STATUS_COLORS[status] || { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border' },
    }))
  }, [clients])

  if (isLoading) {
    return <KanbanBoardSkeleton />
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
      {columns.map((column) => (
        <KanbanColumn key={column.status} column={column} />
      ))}
    </div>
  )
}

interface KanbanColumnProps {
  column: KanbanColumn
}

function KanbanColumn({ column }: KanbanColumnProps) {
  const hasClients = column.clients.length > 0

  return (
    <div className="flex-shrink-0 w-72">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'w-3 h-3 rounded-full',
              column.colors.bg === 'bg-muted' ? 'bg-muted-foreground/30' : column.colors.bg.replace('bg-', 'bg-').replace('-light', '')
            )}
          />
          <h3 className="font-medium text-foreground text-sm">{column.label}</h3>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {column.clients.length}
        </span>
      </div>

      {/* Column Content */}
      <div
        className={cn(
          'bg-muted/30 rounded-xl p-3 min-h-[200px] space-y-3',
          'border-2 border-dashed',
          hasClients ? 'border-transparent' : 'border-border'
        )}
      >
        {hasClients ? (
          column.clients.map((client) => (
            <ClientCard key={client.id} client={client} />
          ))
        ) : (
          <EmptyColumnState label={column.label} />
        )}
      </div>
    </div>
  )
}

function EmptyColumnState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Users className="w-8 h-8 mb-2 opacity-50" aria-hidden="true" />
      <p className="text-sm text-center">{UI_TEXT.kanban.noClients}</p>
      <p className="text-xs mt-1">{label}</p>
    </div>
  )
}

/**
 * Skeleton loader for Kanban board
 */
export function KanbanBoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
      {COLUMN_ORDER.slice(0, 4).map((status, index) => (
        <div key={status} className="flex-shrink-0 w-72">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-muted animate-pulse" />
              <div className="h-4 w-20 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-5 w-8 bg-muted rounded-full animate-pulse" />
          </div>
          <div className="bg-muted/30 rounded-xl p-3 min-h-[200px] space-y-3">
            {/* Show different skeleton counts per column */}
            {Array.from({ length: index === 0 ? 3 : index === 1 ? 2 : 1 }).map((_, i) => (
              <ClientCardSkeleton key={i} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
