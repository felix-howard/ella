/**
 * Single template row in the templates list. Edit triggers a parent-controlled
 * modal; archive/unarchive run inline mutations with a window.confirm prompt
 * (matches the codebase's lightweight confirmation style — no dedicated dialog).
 */
import { useTranslation } from 'react-i18next'
import { Pencil, Archive, ArchiveRestore } from 'lucide-react'
import { useTemplateMutations } from './use-template-mutations'
import type { AgreementTemplate } from '../../lib/api-client'

interface Props {
  template: AgreementTemplate
  onEdit: (template: AgreementTemplate) => void
}

export function TemplateRow({ template, onEdit }: Props) {
  const { t, i18n } = useTranslation()
  const { archive, unarchive } = useTemplateMutations()

  const isMutating =
    (archive.isPending && archive.variables === template.id) ||
    (unarchive.isPending && unarchive.variables === template.id)

  const updatedLabel = new Date(template.updatedAt).toLocaleDateString(
    i18n.language === 'vi' ? 'vi-VN' : 'en-US',
    { year: 'numeric', month: 'short', day: 'numeric' },
  )

  const handleArchive = () => {
    if (!window.confirm(t('agreementTemplates.confirmArchive'))) return
    archive.mutate(template.id)
  }

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {template.name}
          </span>
          <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {t(`agreements.type.${template.type}`)}
          </span>
          {template.isArchived && (
            <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {t('agreementTemplates.archivedBadge')}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
          <span>{t('agreementTemplates.updatedAt', { date: updatedLabel })}</span>
          {template.defaultDepositAmount && (
            <span>
              · {t('agreementTemplates.defaultDeposit', {
                amount: template.defaultDepositAmount,
              })}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {!template.isArchived && (
          <button
            type="button"
            onClick={() => onEdit(template)}
            disabled={isMutating}
            title={t('common.edit')}
            aria-label={t('common.edit')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Pencil className="w-4 h-4" />
          </button>
        )}
        {template.isArchived ? (
          <button
            type="button"
            onClick={() => unarchive.mutate(template.id)}
            disabled={isMutating}
            title={t('agreementTemplates.unarchive')}
            aria-label={t('agreementTemplates.unarchive')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <ArchiveRestore className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleArchive}
            disabled={isMutating}
            title={t('agreementTemplates.archive')}
            aria-label={t('agreementTemplates.archive')}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
