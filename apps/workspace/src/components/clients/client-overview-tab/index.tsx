/**
 * Client Overview Tab - Main container composing all sub-components
 * Grid layout: Profile card (full width), Stats, Activity + Staff + Notes
 */
import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { useQueryClient } from '@tanstack/react-query'
import { type ClientDetail } from '../../../lib/api-client'
import { ClientLinkedEntityCard } from './client-linked-entity-card'
import { ClientMetaInfo } from './client-meta-info'
import { ClientQuickStats } from './client-quick-stats'
import { ClientActivityTimeline } from './client-activity-timeline'
import { ClientAssignedStaff } from './client-assigned-staff'
import { ClientNotesEditor } from './client-notes-editor'

interface ClientOverviewTabProps {
  client: ClientDetail
  onDeleteClick?: () => void
}

export function ClientOverviewTab({ client, onDeleteClick }: ClientOverviewTabProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return (
    <div className="space-y-6">
      {/* Linked Entity Card - Shows linked business or owner */}
      {(client.clientType === 'INDIVIDUAL' || (client.clientGroup && client.clientGroup.clients.length > 0)) && (
        <ClientLinkedEntityCard
          clientId={client.id}
          clientPhone={client.phone}
          clientEmail={client.email}
          currentClientType={client.clientType}
          linkedClients={client.clientGroup?.clients || []}
          onBusinessAdded={() => queryClient.invalidateQueries({ queryKey: ['clients', client.id] })}
        />
      )}

      {/* Audit metadata: created/updated dates and staff */}
      <ClientMetaInfo
        createdAt={client.createdAt}
        updatedAt={client.updatedAt}
        createdBy={client.createdBy}
        updatedBy={client.updatedBy}
      />

      {/* Quick Stats - 4 cards in responsive grid */}
      <ClientQuickStats clientId={client.id} />

      {/* Two column layout: Notes (wider) + Assigned Staff (narrower) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notes Editor - Rich text notes with auto-save (2/3 width) */}
        <div className="lg:col-span-2">
          <ClientNotesEditor
            clientId={client.id}
            initialContent={client.notes ?? null}
          />
        </div>

        {/* Managed By (1/3 width) */}
        <ClientAssignedStaff clientId={client.id} managedBy={client.managedBy} />
      </div>

      {/* Activity Timeline - Full width */}
      <ClientActivityTimeline clientId={client.id} />

      {/* Danger Zone */}
      {onDeleteClick && (
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6">
          <h3 className="text-sm font-semibold text-destructive mb-1">
            {t('clientDetail.dangerZone')}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            {t('clientDetail.dangerZoneDesc')}
          </p>
          <Button
            variant="destructive"
            size="sm"
            onClick={onDeleteClick}
          >
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            {t('clientDetail.deleteClient')}
          </Button>
        </div>
      )}
    </div>
  )
}

// Re-export sub-components for direct imports if needed
export { ClientQuickStats } from './client-quick-stats'
export { ClientActivityTimeline } from './client-activity-timeline'
export { ClientAssignedStaff } from './client-assigned-staff'
export { ClientAvatarUploader } from './client-avatar-uploader'
export { ClientNotesEditor } from './client-notes-editor'
