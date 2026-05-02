/**
 * Wizard Step 3 — Content editor + metadata.
 *
 * Controlled by the orchestrator (`<AgreementSendWizard>`): all user-editable
 * fields live in `draft` so Back navigation does not lose input. Each draft
 * field is nullable — null means "untouched, fall back to the seed". Once the
 * user types/toggles, the override captures their value verbatim.
 *
 * Seeds editor HTML based on (type, templateId):
 *   - NDA: fetches /agreements/default-html (built-in template-v1, vars filled)
 *   - Other type + templateId: pulls template.contentHtml verbatim
 *   - Blank or CUSTOM: empty editor
 *
 * Beyond content: title (defaults to type label), deposit toggle (NDA on by
 * default), deposit amount (from template default or constant), internal note.
 *
 * Validation is UX-only — server is source of truth.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Send, FileText } from 'lucide-react'
import { RichTextEditor } from '../../leads/rich-text-editor'
import { NdaPdfPreviewModal } from '../agreement-pdf-preview-modal'
import { useAgreementDefaultHtml } from '../use-agreement-default-html'
import { api } from '../../../lib/api-client'
import type { AgreementType } from '../../../lib/api-client'
import type { EntityRef } from '../types'

export interface Step3Draft {
  titleOverride: string | null
  htmlOverride: string | null
  depositEnabledOverride: boolean | null
  depositAmountOverride: string | null
  internalNote: string
}

export const emptyStep3Draft: Step3Draft = {
  titleOverride: null,
  htmlOverride: null,
  depositEnabledOverride: null,
  depositAmountOverride: null,
  internalNote: '',
}

export interface Step3Resolved {
  title: string
  contentHtml: string
  depositEnabled: boolean
  depositAmount: string
  internalNote: string
}

interface Props {
  entity: EntityRef
  type: AgreementType
  templateId: string | null
  isSubmitting: boolean
  draft: Step3Draft
  onDraftChange: (draft: Step3Draft) => void
  onCancel: () => void
  onSubmit: (resolved: Step3Resolved) => void
}

const DEFAULT_DEPOSIT_AMOUNT = '500.00'
/** Mirrors server-side `AGREEMENT_HTML_MAX_LENGTH` to avoid round-trip 422s. */
const HTML_MAX = 50_000

function defaultTitleFor(type: AgreementType, t: (k: string) => string): string {
  return t(`agreements.type.${type}`)
}

export function Step3ContentEditor({
  entity,
  type,
  templateId,
  isSubmitting,
  draft,
  onDraftChange,
  onCancel,
  onSubmit,
}: Props) {
  const { t } = useTranslation()
  const [previewOpen, setPreviewOpen] = useState(false)

  // Default-HTML fetch (NDA only). Other types seed from template fetch below
  // or leave the editor blank.
  const defaultHtmlQuery = useAgreementDefaultHtml(entity, type === 'NDA')

  // Template fetch (non-NDA types only when a templateId was selected).
  const templateQuery = useQuery({
    queryKey: ['agreement-templates', 'detail', templateId],
    queryFn: () =>
      api.agreementTemplates.get(templateId as string).then((res) => res.data),
    enabled: type !== 'NDA' && !!templateId,
    staleTime: Infinity,
  })

  const seedHtml: string =
    type === 'NDA'
      ? defaultHtmlQuery.data?.data.contentHtml ?? ''
      : templateId
        ? templateQuery.data?.contentHtml ?? ''
        : ''

  const templateDefaultDeposit = templateQuery.data?.defaultDepositAmount ?? null

  const effectiveTitle = draft.titleOverride ?? defaultTitleFor(type, t)
  const effectiveHtml = draft.htmlOverride ?? seedHtml
  const effectiveDepositEnabled =
    draft.depositEnabledOverride ?? type === 'NDA'
  const effectiveDepositAmount =
    draft.depositAmountOverride ?? templateDefaultDeposit ?? DEFAULT_DEPOSIT_AMOUNT

  // Spread-update helper keeps callsites terse and avoids stale-closure traps.
  const patch = (partial: Partial<Step3Draft>) =>
    onDraftChange({ ...draft, ...partial })

  const seedLoading =
    (type === 'NDA' && defaultHtmlQuery.isLoading) ||
    (type !== 'NDA' && !!templateId && templateQuery.isLoading)
  const seedError =
    (type === 'NDA' && defaultHtmlQuery.isError) ||
    (type !== 'NDA' && !!templateId && templateQuery.isError)

  const titleTrim = effectiveTitle.trim()
  const htmlTrim = effectiveHtml.trim()
  const depositValid =
    !effectiveDepositEnabled ||
    /^\d+(\.\d{1,2})?$/.test(effectiveDepositAmount.trim())
  const canSubmit =
    !!titleTrim &&
    htmlTrim.length > 0 &&
    depositValid &&
    !seedLoading &&
    !seedError &&
    !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit) return
    onSubmit({
      title: titleTrim,
      contentHtml: effectiveHtml,
      depositEnabled: effectiveDepositEnabled,
      depositAmount: effectiveDepositAmount.trim(),
      internalNote: draft.internalNote,
    })
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="block text-xs font-medium text-muted-foreground mb-1">
          {t('agreements.wizard.fields.titleLabel')}
        </span>
        <input
          type="text"
          value={effectiveTitle}
          onChange={(e) => patch({ titleOverride: e.target.value })}
          maxLength={200}
          disabled={isSubmitting}
          placeholder={t('agreements.wizard.fields.titlePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </label>

      <div>
        <span className="block text-xs font-medium text-muted-foreground mb-1">
          {t('agreements.wizard.fields.contentLabel')}
        </span>
        {seedLoading ? (
          <div className="flex items-center justify-center min-h-[320px] rounded-lg border border-border bg-muted/20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : seedError ? (
          <p className="text-destructive text-sm py-4">
            {t('agreements.wizard.contentLoadError')}
          </p>
        ) : (
          <RichTextEditor
            value={effectiveHtml}
            onChange={(html) => patch({ htmlOverride: html })}
            maxLength={HTML_MAX}
            className="min-h-[320px]"
          />
        )}
      </div>

      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={effectiveDepositEnabled}
          onChange={(e) => patch({ depositEnabledOverride: e.target.checked })}
          disabled={isSubmitting}
          className="mt-0.5"
        />
        <span className="text-sm text-foreground">
          {t('agreements.wizard.fields.depositToggle')}
          <span className="block text-xs text-muted-foreground">
            {t('agreements.wizard.fields.depositToggleHint')}
          </span>
        </span>
      </label>

      {effectiveDepositEnabled && (
        <label className="block max-w-xs">
          <span className="block text-xs font-medium text-muted-foreground mb-1">
            {t('agreements.wizard.fields.depositAmountLabel')}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={effectiveDepositAmount}
            onChange={(e) => patch({ depositAmountOverride: e.target.value })}
            disabled={isSubmitting}
            placeholder="500.00"
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {!depositValid && (
            <span className="text-xs text-destructive mt-1 block">
              {t('agreements.wizard.fields.depositAmountInvalid')}
            </span>
          )}
        </label>
      )}

      <label className="block">
        <span className="block text-xs font-medium text-muted-foreground mb-1">
          {t('agreements.wizard.fields.internalNoteLabel')}
        </span>
        <textarea
          value={draft.internalNote}
          onChange={(e) => patch({ internalNote: e.target.value })}
          rows={2}
          maxLength={2000}
          disabled={isSubmitting}
          placeholder={t('agreements.wizard.fields.internalNotePlaceholder')}
          className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />
      </label>

      <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={() => setPreviewOpen(true)}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-border hover:bg-muted transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          {t('nda.editor.preview')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
          {t('nda.send.confirmCta')}
        </button>
      </div>

      <NdaPdfPreviewModal
        open={previewOpen}
        entity={entity}
        contentHtml={effectiveHtml}
        type={type}
        title={effectiveTitle}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  )
}
