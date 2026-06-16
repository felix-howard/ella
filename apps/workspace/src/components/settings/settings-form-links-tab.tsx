/**
 * Settings Form Links Tab - Contains org slug editor, registration link reference, and Client Intake Form Link
 */
import { ClientFormLinkCard } from './client-form-link-card'
import { OrgSlugEditor } from './org-slug-editor'

export function SettingsFormLinksTab() {
  return (
    <div className="space-y-4">
      <OrgSlugEditor />

      <ClientFormLinkCard />
    </div>
  )
}
