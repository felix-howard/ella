/**
 * Client Overview Tab - Main container composing all sub-components
 * Grid layout: Profile card (full width), Stats, Activity + Staff + Notes
 */
import { type ClientDetail } from '../../../lib/api-client'
import { ClientProfileCard } from './client-profile-card'
import { ClientQuickStats } from './client-quick-stats'
import { ClientActivityTimeline } from './client-activity-timeline'
import { ClientAssignedStaff } from './client-assigned-staff'
import { ClientNotesEditor } from './client-notes-editor'

interface ClientOverviewTabProps {
  client: ClientDetail
}

export function ClientOverviewTab({ client }: ClientOverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Profile Card - Full width */}
      <ClientProfileCard client={client} />

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

        {/* Assigned Staff (1/3 width) */}
        <ClientAssignedStaff clientId={client.id} />
      </div>

      {/* Activity Timeline - Full width */}
      <ClientActivityTimeline clientId={client.id} />
    </div>
  )
}

// Re-export sub-components for direct imports if needed
export { ClientProfileCard } from './client-profile-card'
export { ClientQuickStats } from './client-quick-stats'
export { ClientActivityTimeline } from './client-activity-timeline'
export { ClientAssignedStaff } from './client-assigned-staff'
export { ClientAvatarUploader } from './client-avatar-uploader'
export { ClientNotesEditor } from './client-notes-editor'
