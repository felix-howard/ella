import { useState } from 'react'
import { Loader2, Link as LinkIcon } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Card } from '@ella/ui'
import { api, type IntakeLinkStaffRow, type OrgSettingsUpdateInput } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'
import { OrgSlugEditor } from './org-slug-editor'
import { IntakeLinkSettingsModal } from './intake-link-settings-modal'
import { IntakeLinkTable } from './intake-link-table'
import { formatUploadSummary } from './intake-link-upload-summary'
import { UploadLinkMessageSettings } from './upload-link-message-settings'

export function ClientFormLinkCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    canManageOrganizationSettings,
    canManageOwnIntakeLink,
    canManageAnyIntakeLink,
    staffId,
  } = useOrgRole()
  const [editingStaff, setEditingStaff] = useState<IntakeLinkStaffRow | null>(null)
  const canLoadIntakeLinks = canManageAnyIntakeLink || canManageOwnIntakeLink

  const orgSettings = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const intakeLinks = useQuery({
    queryKey: ['org-intake-links'],
    queryFn: () => api.orgSettings.getIntakeLinks(),
    enabled: canLoadIntakeLinks,
  })

  const updateDefaults = useMutation({
    mutationFn: (data: OrgSettingsUpdateInput) => api.orgSettings.update(data),
    onSuccess: (result) => {
      queryClient.setQueryData(['org-settings'], result)
      queryClient.invalidateQueries({ queryKey: ['org-intake-links'] })
      toast.success(t('settings.saved'))
    },
    onError: () => {
      toast.error(t('settings.saveFailed'))
    },
  })

  const isLoading = orgSettings.isLoading || (canLoadIntakeLinks && intakeLinks.isLoading)

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="h-48 rounded bg-muted animate-pulse" />
      </Card>
    )
  }

  const settings = orgSettings.data
  const links = intakeLinks.data
  const defaultAutoSend = settings?.autoSendFormClientUploadLink ?? links?.organization.autoSendUploadLink ?? false
  const defaultLanguage = settings?.defaultUploadLinkLanguage ?? links?.organization.defaultUploadLinkLanguage ?? 'EN'
  const defaultTemplateId = settings
    ? settings.defaultUploadLinkTemplateId
    : links?.organization.defaultUploadLinkTemplateId ?? null
  const isUpdatingDefaults = updateDefaults.isPending
  const allStaffLinks = links?.staffLinks ?? []
  const visibleStaffLinks = canManageAnyIntakeLink
    ? allStaffLinks
    : allStaffLinks.filter((staff) => staff.id === staffId)
  const defaultsSummary = formatUploadSummary(t, defaultAutoSend, defaultLanguage, defaultTemplateId)
  const intakeTitleKey = canManageAnyIntakeLink ? 'settings.intakeLinks' : 'settings.yourPersonalIntakeLink'
  const intakeDescriptionKey = canManageAnyIntakeLink
    ? 'settings.intakeLinksDescription'
    : 'settings.yourPersonalIntakeLinkDescription'
  const missingOrgSlugLabelKey = canManageAnyIntakeLink
    ? 'settings.noSlugConfigured'
    : 'settings.organizationUrlSlugMissingAskAdmin'
  const showUnavailableState = !canLoadIntakeLinks || visibleStaffLinks.length === 0

  return (
    <section data-settings-focus="client-intake" className="space-y-4">
      <Card className="p-6">
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <LinkIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{t('settings.clientIntake')}</h2>
            <p className="text-sm text-muted-foreground">
              {canManageOrganizationSettings
                ? t('settings.clientIntakeDescription')
                : t('settings.clientIntakePersonalDescription')}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <OrgSlugEditor />

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">{t('settings.defaultUploadMessageSettings')}</h3>
                <p className="text-xs text-muted-foreground">
                  {canManageOrganizationSettings
                    ? t('settings.defaultUploadMessageSettingsDescription')
                    : t('settings.organizationDefaultsManagedByAdmins')}
                </p>
              </div>
              {isUpdatingDefaults && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {canManageOrganizationSettings ? (
              <UploadLinkMessageSettings
                autoSend={defaultAutoSend}
                language={defaultLanguage}
                templateId={defaultTemplateId}
                disabled={isUpdatingDefaults}
                name="orgDefaultUploadLinkTemplate"
                onAutoSendChange={(enabled) => updateDefaults.mutate({ autoSendFormClientUploadLink: enabled })}
                onLanguageChange={(language) => updateDefaults.mutate({ defaultUploadLinkLanguage: language })}
                onTemplateChange={(templateId) => updateDefaults.mutate({ defaultUploadLinkTemplateId: templateId })}
                allowDefaultTemplate
              />
            ) : (
              <div className="rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {defaultsSummary}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4">
              <h3 className="text-sm font-medium text-foreground">{t(intakeTitleKey)}</h3>
              <p className="text-xs text-muted-foreground">{t(intakeDescriptionKey)}</p>
            </div>
            {intakeLinks.isError ? (
              <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {t('settings.intakeLinksLoadError')}
              </p>
            ) : showUnavailableState ? (
              <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                {t('settings.personalIntakeLinkUnavailable')}
              </p>
            ) : (
              <IntakeLinkTable
                orgSlug={links?.organization.slug ?? null}
                generalUrlPath={links?.generalLink.urlPath ?? null}
                generalAutoSend={defaultAutoSend}
                generalLanguage={defaultLanguage}
                generalTemplateId={defaultTemplateId}
                staffLinks={visibleStaffLinks}
                canEditStaffLinks
                includeGeneralLink={canManageAnyIntakeLink}
                missingOrgSlugLabelKey={missingOrgSlugLabelKey}
                onEditStaff={setEditingStaff}
              />
            )}
          </div>
        </div>
      </Card>

      <IntakeLinkSettingsModal
        staff={editingStaff}
        open={Boolean(editingStaff)}
        onClose={() => setEditingStaff(null)}
      />
    </section>
  )
}
