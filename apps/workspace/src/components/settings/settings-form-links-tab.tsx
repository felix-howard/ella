/**
 * Settings Form Links Tab - Contains org slug editor, registration link reference, and Client Intake Form Link
 */
import { useTranslation } from 'react-i18next'
import { Link } from '@tanstack/react-router'
import { Megaphone } from 'lucide-react'
import { ClientFormLinkCard } from './client-form-link-card'
import { OrgSlugEditor } from './org-slug-editor'

export function SettingsFormLinksTab() {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <OrgSlugEditor />

      {/* Registration link reference - points to Campaigns tab */}
      <div className="rounded-xl border border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Megaphone className="w-4 h-4 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground flex-1">
            {t('leads.manageLinksInCampaigns')}{' '}
            <Link to="/leads" className="text-primary hover:underline font-medium">
              {t('leads.manageLinksInCampaignsLink')}
            </Link>
          </p>
        </div>
      </div>

      <ClientFormLinkCard />
    </div>
  )
}
