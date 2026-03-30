/**
 * Settings Form Links Tab - Contains org slug editor, Lead Registration Form Link, and Client Intake Form Link
 */
import { LeadFormLinkCard } from '../leads/lead-form-link-card'
import { ClientFormLinkCard } from './client-form-link-card'
import { OrgSlugEditor } from './org-slug-editor'

export function SettingsFormLinksTab() {
  return (
    <div className="space-y-4">
      <OrgSlugEditor />
      <LeadFormLinkCard />
      <ClientFormLinkCard />
    </div>
  )
}
