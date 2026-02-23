/**
 * Assigned Clients List - Expandable list showing clients assigned to staff
 */
import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Users, ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@ella/ui'

interface AssignedClientsListProps {
  clients: Array<{ id: string; name: string; phone: string }>
  totalCount: number
  isAdmin?: boolean
}

const COLLAPSED_LIMIT = 5

export function AssignedClientsList({ clients, totalCount, isAdmin }: AssignedClientsListProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(false)

  const displayClients = isExpanded ? clients : clients.slice(0, COLLAPSED_LIMIT)
  const hasMore = totalCount > COLLAPSED_LIMIT

  // Admin sees "All Clients", staff sees "Assigned Clients"
  const title = isAdmin ? t('profile.allClients') : t('profile.assignedClients')

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        </div>
        <Badge variant="secondary">{totalCount}</Badge>
      </div>

      {/* Client List */}
      {clients.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {isAdmin ? t('profile.noClientsInOrg') : t('profile.noAssignedClients')}
        </p>
      ) : (
        <ul className="space-y-2">
          {displayClients.map((client) => (
            <li key={client.id}>
              <Link
                to="/clients/$clientId"
                params={{ clientId: client.id }}
                className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-muted transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{client.name}</span>
                <span className="text-xs text-muted-foreground">{client.phone}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Expand/Collapse */}
      {hasMore && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline mt-4"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              {t('common.collapse')}
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              {t('common.showMore', { count: totalCount - COLLAPSED_LIMIT })}
            </>
          )}
        </button>
      )}
    </div>
  )
}
