/**
 * Settings Form Links Tab - Contains Lead Registration Form Link and Client Intake Form Link
 */
import { LeadFormLinkCard } from '../leads/lead-form-link-card'
import { ClientFormLinkCard } from './client-form-link-card'

export function SettingsFormLinksTab() {
  return (
    <div className="space-y-4">
      <LeadFormLinkCard defaultExpanded />
      <ClientFormLinkCard />
    </div>
  )
}
