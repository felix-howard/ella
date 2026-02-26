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

      {/* Two column layout on desktop: Activity + Assigned Staff */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Activity Timeline */}
        <ClientActivityTimeline clientId={client.id} />

        {/* Assigned Staff */}
        <ClientAssignedStaff clientId={client.id} />
      </div>

      {/* Notes Editor - Rich text notes with auto-save */}
      <ClientNotesEditor
        clientId={client.id}
        initialContent={client.notes ?? null}
      />
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
