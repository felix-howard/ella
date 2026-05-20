import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, ExternalLink, KeyRound, Loader2, RotateCw, Send, ShieldOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, cn } from '@ella/ui'
import { api, type UploadLinkData } from '../../lib/api-client'
import { copyToClipboard } from '../../lib/clipboard'
import { toast } from '../../stores/toast-store'
import { UploadLinkConfirmModal } from './upload-link-confirm-modal'
import { UploadLinkExtendMenu, type UploadLinkExtendDays } from './upload-link-extend-menu'
import { getDaysUntilExpiry } from './upload-link-state'
import { UploadLinkStatusBadge } from './upload-link-status-badge'
interface UploadLinkManagerProps {
  caseId: string
  clientId?: string
  onSendSms?: () => void
  isSendingSms?: boolean
}
type ConfirmAction = 'revoke' | 'replace'
function formatDate(value: string | null, locale: string) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' })
}
function selectDisplayLink(links: UploadLinkData[]) {
  return links.find((link) => link.status === 'ACTIVE') ?? links[0] ?? null
}
export function UploadLinkManager({ caseId, clientId, onSendSms, isSendingSms = false }: UploadLinkManagerProps) {
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const queryKey = ['uploadLinks', caseId] as const
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => api.uploadLinks.listForCase(caseId),
    enabled: !!caseId,
    staleTime: 30_000,
  })
  const currentLink = useMemo(() => selectDisplayLink(data?.data ?? []), [data?.data])
  const canUseLink = currentLink?.status === 'ACTIVE' && !!currentLink.url
  const canExtend = currentLink?.status === 'ACTIVE' || currentLink?.status === 'EXPIRED'
  const expiryDate = formatDate(currentLink?.expiresAt ?? null, i18n.language)
  const daysUntilExpiry = getDaysUntilExpiry(currentLink?.expiresAt ?? null)
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey })
    await queryClient.invalidateQueries({ queryKey: ['activity'] })
    if (clientId) {
      await queryClient.invalidateQueries({ queryKey: ['client', clientId] })
    }
  }
  const revokeMutation = useMutation({
    mutationFn: (id: string) => api.uploadLinks.revoke(id),
    onSuccess: async () => {
      toast.success(t('uploadLinks.revokeSuccess'))
      setConfirmAction(null)
      await invalidate()
    },
    onError: () => toast.error(t('uploadLinks.revokeError')),
  })
  const extendMutation = useMutation({
    mutationFn: ({ id, days }: { id: string; days: UploadLinkExtendDays }) =>
      api.uploadLinks.extend(id, days),
    onSuccess: async () => {
      toast.success(t('uploadLinks.extendSuccess'))
      await invalidate()
    },
    onError: () => toast.error(t('uploadLinks.extendError')),
  })
  const generateMutation = useMutation({
    mutationFn: () => api.uploadLinks.generate(caseId),
    onSuccess: async () => {
      toast.success(t(currentLink ? 'uploadLinks.replaceSuccess' : 'uploadLinks.generateSuccess'))
      setConfirmAction(null)
      await invalidate()
    },
    onError: () => toast.error(t('uploadLinks.generateError')),
  })
  const handleCopy = async () => {
    if (!currentLink?.url) return
    await copyToClipboard(currentLink.url, {
      successMsg: t('uploadLinks.copySuccess'),
      errorMsg: t('uploadLinks.copyError'),
    })
  }
  const handleGenerate = () => {
    if (isError) return
    if (currentLink) {
      setConfirmAction('replace')
      return
    }
    generateMutation.mutate()
  }
  const isMutating = revokeMutation.isPending || extendMutation.isPending || generateMutation.isPending
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="h-4 w-4 text-primary" />
              {t('uploadLinks.title')}
            </div>
            {isLoading ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t('common.loading')}
              </span>
            ) : (
              <UploadLinkStatusBadge link={currentLink} />
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {isError && <span className="text-destructive">{t('uploadLinks.loadError')}</span>}
            {!isLoading && !isError && !currentLink && <span>{t('uploadLinks.noLink')}</span>}
            {expiryDate && (
              <span>
                {t('uploadLinks.expiresOn', { date: expiryDate })}
                {typeof daysUntilExpiry === 'number' && daysUntilExpiry >= 0 && (
                  <span className={cn(daysUntilExpiry <= 3 && 'text-amber-600 font-medium')}>
                    {' '}
                    {t('uploadLinks.daysLeft', { days: daysUntilExpiry })}
                  </span>
                )}
              </span>
            )}
            {currentLink?.lastUsedAt && (
              <span>{t('uploadLinks.lastUsed', { date: formatDate(currentLink.lastUsedAt, i18n.language) })}</span>
            )}
            {currentLink && <span>{t('uploadLinks.usageCount', { count: currentLink.usageCount })}</span>}
          </div>
          {canUseLink && currentLink.url && (
            <div className="flex max-w-2xl items-center gap-2 rounded-md border border-border/50 bg-muted/40 px-2.5 py-1.5">
              <code className="min-w-0 flex-1 truncate text-xs text-foreground/80">{currentLink.url}</code>
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={t('uploadLinks.copy')}
                title={t('uploadLinks.copy')}
              >
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUseLink && currentLink.url && (
            <Button type="button" variant="outline" size="sm" onClick={() => window.open(currentLink.url!, '_blank', 'noopener,noreferrer')} className="gap-1.5">
              <ExternalLink className="h-3.5 w-3.5" />
              {t('uploadLinks.open')}
            </Button>
          )}
          <Button type="button" variant="outline" size="sm" onClick={onSendSms} disabled={!onSendSms || isSendingSms} className="gap-1.5">
            {isSendingSms ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {t(currentLink ? 'uploadLinks.resendSms' : 'uploadLinks.sendSms')}
          </Button>
          {canExtend && currentLink && (
            <UploadLinkExtendMenu
              isLoading={extendMutation.isPending}
              onSelect={(days) => extendMutation.mutate({ id: currentLink.id, days })}
            />
          )}
          {canUseLink && currentLink && (
            <Button type="button" variant="outline" size="sm" onClick={() => setConfirmAction('revoke')} disabled={isMutating} className="gap-1.5">
              <ShieldOff className="h-3.5 w-3.5" />
              {t('uploadLinks.revoke')}
            </Button>
          )}
          <Button type="button" size="sm" onClick={handleGenerate} disabled={isMutating || isError} className="gap-1.5">
            {generateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
            {t(currentLink ? 'uploadLinks.replace' : 'uploadLinks.generate')}
          </Button>
        </div>
      </div>
      <UploadLinkConfirmModal
        open={confirmAction === 'revoke'}
        title={t('uploadLinks.revokeTitle')}
        description={t('uploadLinks.revokeDescription')}
        confirmLabel={t('uploadLinks.revoke')}
        variant="destructive"
        isPending={revokeMutation.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => currentLink && revokeMutation.mutate(currentLink.id)}
      />
      <UploadLinkConfirmModal
        open={confirmAction === 'replace'}
        title={t('uploadLinks.replaceTitle')}
        description={t('uploadLinks.replaceDescription')}
        confirmLabel={t('uploadLinks.replace')}
        isPending={generateMutation.isPending}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => generateMutation.mutate()}
      />
    </div>
  )
}
