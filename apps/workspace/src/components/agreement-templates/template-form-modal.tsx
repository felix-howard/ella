/**
 * Create/edit modal for agreement templates.
 * - Create mode (template = null): name, type, contentHtml, defaultDepositAmount.
 * - Edit mode: type is locked (server doesn't allow changing it; would break
 *   filter/wizard contract). Name/content/deposit are editable.
 *
 * Reuses the wizard's `RichTextEditor`. HTML cap mirrors the wizard
 * (`HTML_MAX = 50_000`) to avoid round-trip 422s from the agreements POST.
 */
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import { RichTextEditor } from '../leads/rich-text-editor'
import { useTemplateMutations } from './use-template-mutations'
import type {
  AgreementTemplate,
  AgreementTemplateType,
} from '../../lib/api-client'

const HTML_MAX = 50_000
// Mirrors `createTemplateBodySchema.name.min(3)` on the server to avoid 422s.
const NAME_MIN = 3
const TEMPLATE_TYPES: AgreementTemplateType[] = [
  'NDA',
  'ENGAGEMENT_LETTER',
  'SERVICE_AGREEMENT',
]
const DEPOSIT_REGEX = /^\d+(\.\d{1,2})?$/

interface Props {
  template: AgreementTemplate | null
  onClose: () => void
}

export function TemplateFormModal({ template, onClose }: Props) {
  const { t } = useTranslation()
  const { create, update } = useTemplateMutations()
  const isEdit = !!template
  const titleId = useId()

  const [name, setName] = useState(template?.name ?? '')
  const [type, setType] = useState<AgreementTemplateType>(
    template?.type ?? 'ENGAGEMENT_LETTER',
  )
  const [contentHtml, setContentHtml] = useState(template?.contentHtml ?? '')
  const [depositAmount, setDepositAmount] = useState(
    template?.defaultDepositAmount ?? '',
  )

  const isSubmitting = create.isPending || update.isPending

  // Close on parent-driven success.
  useEffect(() => {
    if (create.isSuccess || update.isSuccess) onClose()
  }, [create.isSuccess, update.isSuccess, onClose])

  // Esc closes the modal (skipped while submitting to avoid accidental loss).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.stopPropagation()
        onClose()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isSubmitting, onClose])

  const trimmedName = name.trim()
  const trimmedDeposit = depositAmount.trim()
  const trimmedHtml = contentHtml.trim()

  const depositValid = trimmedDeposit === '' || DEPOSIT_REGEX.test(trimmedDeposit)
  const canSubmit =
    trimmedName.length >= NAME_MIN &&
    trimmedHtml.length > 0 &&
    depositValid &&
    !isSubmitting

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    const depositPayload = trimmedDeposit === '' ? null : trimmedDeposit
    if (isEdit && template) {
      update.mutate({
        id: template.id,
        name: trimmedName,
        contentHtml: trimmedHtml,
        defaultDepositAmount: depositPayload,
      })
    } else {
      create.mutate({
        name: trimmedName,
        type,
        contentHtml: trimmedHtml,
        defaultDepositAmount: depositPayload,
      })
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="bg-card rounded-2xl border border-border w-full max-w-3xl max-h-[90vh] flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 id={titleId} className="text-base font-semibold text-foreground">
            {isEdit
              ? t('agreementTemplates.modal.editTitle')
              : t('agreementTemplates.modal.createTitle')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="px-5 py-4 space-y-4 overflow-y-auto"
        >
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('agreementTemplates.fields.nameLabel')}
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('agreementTemplates.fields.namePlaceholder')}
              maxLength={100}
              autoFocus
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('agreementTemplates.fields.typeLabel')}
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AgreementTemplateType)}
              disabled={isEdit || isSubmitting}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-60"
            >
              {TEMPLATE_TYPES.map((tt) => (
                <option key={tt} value={tt}>
                  {t(`agreements.type.${tt}`)}
                </option>
              ))}
            </select>
            {isEdit && (
              <span className="block text-xs text-muted-foreground mt-1">
                {t('agreementTemplates.fields.typeLockedHint')}
              </span>
            )}
          </label>

          <div>
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('agreementTemplates.fields.contentLabel')}
            </span>
            <RichTextEditor
              value={contentHtml}
              onChange={setContentHtml}
              maxLength={HTML_MAX}
              className="min-h-[280px]"
            />
          </div>

          <label className="block max-w-xs">
            <span className="block text-xs font-medium text-muted-foreground mb-1.5">
              {t('agreementTemplates.fields.defaultDepositLabel')}
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="500.00"
              disabled={isSubmitting}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            <span className="block text-xs text-muted-foreground mt-1">
              {t('agreementTemplates.fields.defaultDepositHint')}
            </span>
            {!depositValid && (
              <span className="block text-xs text-destructive mt-1">
                {t('agreementTemplates.fields.defaultDepositInvalid')}
              </span>
            )}
          </label>

          <div className="flex justify-end gap-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {isEdit ? t('common.save') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
