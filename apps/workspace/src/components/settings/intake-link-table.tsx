import { useState } from 'react'
import { Check, Copy, Edit3, Link as LinkIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, cn } from '@ella/ui'
import type { IntakeLinkStaffRow, Language, UploadLinkTemplateId } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { toast } from '../../stores/toast-store'
import {
  CLIENT_SMS_TEMPLATES,
  DEFAULT_CLIENT_SMS_TEMPLATE_ID,
  resolveClientSmsTemplateId,
} from '../clients/client-sms-templates'

interface IntakeLinkTableProps {
  orgSlug: string | null
  generalUrlPath: string | null
  generalAutoSend: boolean
  generalLanguage: Language
  generalTemplateId: UploadLinkTemplateId | null
  staffLinks: IntakeLinkStaffRow[]
  canManageClients: boolean
  onEditStaff: (staff: IntakeLinkStaffRow) => void
}

type Row = {
  key: string
  name: string
  assignment: string
  url: string | null
  uploadSummary: string
  staff?: IntakeLinkStaffRow
}

function fullUrl(path: string | null) {
  return path ? `${PORTAL_BASE_URL}${path}` : null
}

function formatUploadSummary(
  t: (key: string, options?: Record<string, string>) => string,
  autoSend: boolean,
  language: Language,
  templateId: UploadLinkTemplateId | null
) {
  if (!autoSend) return t('settings.uploadMessageOff')
  const resolvedTemplateId = templateId ? resolveClientSmsTemplateId(templateId) : DEFAULT_CLIENT_SMS_TEMPLATE_ID
  const template = CLIENT_SMS_TEMPLATES.find((item) => item.id === resolvedTemplateId)
  const templateLabel = template ? t(template.labelKey) : resolvedTemplateId
  return t('settings.uploadMessageSummary', {
    language: language === 'EN' ? t('settings.messageLanguageEnglishUs') : t('settings.messageLanguageVietnamese'),
    template: templateId ? templateLabel : t('settings.useDefaultUploadMessage', { template: templateLabel }),
  })
}

export function IntakeLinkTable({
  orgSlug,
  generalUrlPath,
  generalAutoSend,
  generalLanguage,
  generalTemplateId,
  staffLinks,
  canManageClients,
  onEditStaff,
}: IntakeLinkTableProps) {
  const { t } = useTranslation()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const rows: Row[] = [
    {
      key: 'general',
      name: t('settings.generalIntakeLink'),
      assignment: t('settings.assignmentUnassigned'),
      url: fullUrl(generalUrlPath),
      uploadSummary: formatUploadSummary(t, generalAutoSend, generalLanguage, generalTemplateId),
    },
    ...staffLinks.map((staff) => ({
      key: staff.id,
      name: t('settings.personalIntakeLink', { name: staff.name }),
      assignment: staff.name,
      url: fullUrl(staff.urlPath),
      uploadSummary: staff.useOrgUploadLinkDefaults
        ? t('settings.usesOrganizationDefaultSummary', {
            summary: formatUploadSummary(
              t,
              staff.effectiveAutoSendUploadLink,
              staff.effectiveDefaultUploadLinkLanguage,
              staff.effectiveDefaultUploadLinkTemplateId
            ),
          })
        : formatUploadSummary(
          t,
          staff.effectiveAutoSendUploadLink,
          staff.effectiveDefaultUploadLinkLanguage,
          staff.effectiveDefaultUploadLinkTemplateId
        ),
      staff,
    })),
  ]

  const copyLink = async (row: Row) => {
    if (!row.url) return
    try {
      await navigator.clipboard.writeText(row.url)
      setCopiedKey(row.key)
      toast.success(t('settings.linkCopied'))
      window.setTimeout(() => setCopiedKey(null), 2000)
    } catch {
      toast.error(t('settings.copyFailed'))
    }
  }

  return (
    <div className="space-y-3">
      <div className="hidden gap-3 rounded-lg border border-border bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1.1fr_1fr_1.5fr_1.2fr_6.5rem]">
        <span>{t('settings.intakeLinkColumnName')}</span>
        <span>{t('settings.intakeLinkColumnAssignment')}</span>
        <span>{t('settings.intakeLinkColumnUrl')}</span>
        <span>{t('settings.intakeLinkColumnUploadMessage')}</span>
        <span className="text-right">{t('settings.intakeLinkColumnActions')}</span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.key}
            className="grid gap-3 rounded-lg border border-border bg-card p-3 md:grid-cols-[1.1fr_1fr_1.5fr_1.2fr_6.5rem] md:items-start"
          >
            <div className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                {t('settings.intakeLinkColumnName')}
              </span>
              <p className="text-sm font-medium text-foreground">{row.name}</p>
              {!row.staff && <p className="text-xs text-muted-foreground">{t('settings.generalIntakeDescription')}</p>}
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                {t('settings.intakeLinkColumnAssignment')}
              </span>
              <p className="text-sm text-muted-foreground">{row.assignment}</p>
            </div>
            <div className="min-w-0">
              <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                {t('settings.intakeLinkColumnUrl')}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {row.url ? (
                  <code
                    title={row.url}
                    className="min-w-0 max-w-full whitespace-normal break-all rounded bg-muted px-2 py-1 text-xs leading-relaxed text-foreground"
                  >
                    {row.url}
                  </code>
                ) : (
                  <span className="text-xs italic text-muted-foreground">
                    {orgSlug ? t('settings.staffSlugMissing') : t('settings.noSlugConfigured')}
                  </span>
                )}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground md:hidden">
                {t('settings.intakeLinkColumnUploadMessage')}
              </span>
              <p className="text-sm text-muted-foreground">{row.uploadSummary}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => copyLink(row)} disabled={!row.url}>
                {copiedKey === row.key ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                <span className="sr-only">{t('settings.copy')}</span>
              </Button>
              {row.staff && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onEditStaff(row.staff!)}
                  disabled={!canManageClients}
                  className={cn(!canManageClients && 'cursor-not-allowed')}
                >
                  <Edit3 className="h-4 w-4" />
                  <span className="sr-only">{t('common.edit')}</span>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
