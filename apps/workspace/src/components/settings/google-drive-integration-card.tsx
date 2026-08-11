import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { HardDrive, Loader2, Lock, Save } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'

const QUERY_KEY = ['google-drive-connection']

type GoogleDriveSettingsFormProps = {
  canManageOrganizationSettings: boolean
  googleAccountEmail: string
  initialAdminGroupEmail: string
  initialRootFolderId: string
  isConfigured: boolean
  isConnected: boolean
}

export function GoogleDriveIntegrationCard() {
  const { t } = useTranslation()
  const { canManageOrganizationSettings } = useOrgRole()
  const { data, isLoading, isError } = useQuery({ queryKey: QUERY_KEY, queryFn: api.googleDrive.status, enabled: canManageOrganizationSettings })
  const connection = data?.connection
  const settingsKey = JSON.stringify([
    connection?.rootFolderId ?? '',
    connection?.adminGroupEmail ?? '',
    connection?.googleAccountEmail ?? '',
  ])

  return (
    <section className="rounded-xl bg-card shadow-sm" aria-labelledby="google-drive-settings-title">
      <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/50 px-6 py-4">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-primary" aria-hidden="true" />
          <div>
            <h2 id="google-drive-settings-title" className="text-lg font-semibold text-foreground">{t('googleDrive.settingsTitle')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('googleDrive.settingsDescription')}</p>
          </div>
        </div>
        {!canManageOrganizationSettings && <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground"><Lock className="h-3 w-3" aria-hidden="true" />{t('settings.adminOnly')}</span>}
      </div>
      <div className="space-y-4 p-6">
        {!canManageOrganizationSettings ? <p className="text-sm text-muted-foreground">{t('googleDrive.adminOnlyDescription')}</p> : isLoading ? <div className="flex h-16 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label={t('googleDrive.loading')} /></div> : isError ? <p className="rounded-lg bg-error-light p-3 text-sm text-error" role="alert">{t('googleDrive.loadError')}</p> : (
          <GoogleDriveSettingsForm
            key={settingsKey}
            canManageOrganizationSettings={canManageOrganizationSettings}
            googleAccountEmail={connection?.googleAccountEmail ?? ''}
            initialAdminGroupEmail={connection?.adminGroupEmail ?? ''}
            initialRootFolderId={connection?.rootFolderId ?? ''}
            isConfigured={Boolean(data?.isConfigured)}
            isConnected={Boolean(connection)}
          />
        )}
      </div>
    </section>
  )
}

function GoogleDriveSettingsForm({
  canManageOrganizationSettings,
  googleAccountEmail,
  initialAdminGroupEmail,
  initialRootFolderId,
  isConfigured,
  isConnected,
}: GoogleDriveSettingsFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [rootFolderId, setRootFolderId] = useState(initialRootFolderId)
  const [adminGroupEmail, setAdminGroupEmail] = useState(initialAdminGroupEmail)
  const oauthWindowRef = useRef<Window | null>(null)
  const refresh = () => queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  const connectMutation = useMutation({
    mutationFn: () => api.googleDrive.getOAuthUrl({
      rootFolderId: rootFolderId.trim() || undefined,
      adminGroupEmail: adminGroupEmail.trim() || null,
    }),
    onSuccess: ({ url }) => {
      if (!oauthWindowRef.current) return
      oauthWindowRef.current.location.assign(url)
      oauthWindowRef.current = null
    },
    onError: () => toast.error(t('googleDrive.connectError')),
  })
  const saveMutation = useMutation({
    mutationFn: () => api.googleDrive.saveSettings({
      rootFolderId: rootFolderId.trim(),
      adminGroupEmail: adminGroupEmail.trim() || null,
    }),
    onSuccess: () => {
      toast.success(t('googleDrive.saveSuccess'))
      refresh()
    },
    onError: () => toast.error(t('googleDrive.saveError')),
  })
  const isPending = connectMutation.isPending || saveMutation.isPending
  const canSave = Boolean(isConnected && rootFolderId.trim())
  const startConnection = () => {
    const oauthWindow = window.open('', '_blank')
    if (!oauthWindow) {
      toast.error(t('googleDrive.popupBlocked'))
      return
    }
    oauthWindow.opener = null
    oauthWindowRef.current = oauthWindow
    connectMutation.mutate()
  }

  return (
    <>
      {!isConfigured && <p className="rounded-lg bg-warning-light p-3 text-sm text-warning-foreground" role="status">{t('googleDrive.credentialsMissing')}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="google-drive-root-folder" className="mb-1.5 block text-sm font-medium text-foreground">{t('googleDrive.rootFolderId')}</label>
          <Input id="google-drive-root-folder" value={rootFolderId} onChange={(event) => setRootFolderId(event.target.value)} disabled={!canManageOrganizationSettings || isPending} placeholder={t('googleDrive.rootFolderPlaceholder')} />
        </div>
        <div>
          <label htmlFor="google-drive-admin-group" className="mb-1.5 block text-sm font-medium text-foreground">{t('googleDrive.adminGroupEmail')}</label>
          <Input id="google-drive-admin-group" type="email" value={adminGroupEmail} onChange={(event) => setAdminGroupEmail(event.target.value)} disabled={!canManageOrganizationSettings || isPending} placeholder={t('googleDrive.adminGroupPlaceholder')} />
        </div>
      </div>
      {isConnected ? <p className="text-sm text-muted-foreground">{t('googleDrive.connectedAs', { email: googleAccountEmail })}</p> : <p className="text-sm text-muted-foreground">{t('googleDrive.notConnected')}</p>}
      <div className="flex flex-wrap gap-2">
        {!isConnected && <Button onClick={startConnection} disabled={!canManageOrganizationSettings || !isConfigured || !rootFolderId.trim() || isPending}>{connectMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t('googleDrive.connect')}</Button>}
        {isConnected && <Button onClick={() => saveMutation.mutate()} disabled={!canManageOrganizationSettings || !canSave || isPending}><Save className="mr-2 h-4 w-4" aria-hidden="true" />{saveMutation.isPending ? t('googleDrive.testing') : t('googleDrive.saveAndTest')}</Button>}
        <Button variant="outline" onClick={refresh} disabled={isPending}>{t('common.refresh')}</Button>
      </div>
    </>
  )
}
