/**
 * Settings → Agreement Templates tab. Org-admin only.
 * Non-admins see a friendly notice (parent already hides the tab trigger,
 * but the route accepts ?tab=agreement-templates so we still gate here).
 */
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { useOrgRole } from '../../hooks/use-org-role'
import { TemplateList } from '../agreement-templates/template-list'

export function SettingsAgreementTemplatesTab() {
  const { t } = useTranslation()
  const { isAdmin, isLoading } = useOrgRole()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        {t('agreementTemplates.adminOnly')}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t('agreementTemplates.heading')}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {t('agreementTemplates.description')}
        </p>
      </div>
      <TemplateList />
    </div>
  )
}
