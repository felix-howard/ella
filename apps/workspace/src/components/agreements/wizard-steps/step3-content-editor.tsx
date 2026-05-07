/**
 * Wizard Step 3 — Content editor + metadata.
 *
 * Controlled by the orchestrator (`<AgreementSendWizard>`): all user-editable
 * fields live in `draft` so Back navigation does not lose input. Each draft
 * field is nullable — null means "untouched, fall back to the seed". Once the
 * user types/toggles, the override captures their value verbatim.
 *
 * Seeds editor HTML based on (type, templateId):
 *   - NDA + BUILTIN_NDA_TEMPLATE: fetches /agreements/default-html (built-in
 *     template, vars filled)
 *   - Any type + real templateId: pulls template.contentHtml verbatim
 *   - BLANK_TEMPLATE / null / CUSTOM: empty editor
 *
 * Beyond content: title (defaults to type label), deposit toggle (NDA on by
 * default), deposit amount (from template default or constant), internal note.
 *
 * Validation is UX-only — server is source of truth.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, FileText } from 'lucide-react'
import { RichTextEditor } from '../../leads/rich-text-editor'
import { NdaPdfPreviewModal } from '../agreement-pdf-preview-modal'
import { useAgreementDefaultHtml } from '../use-agreement-default-html'
import {
  BLANK_TEMPLATE,
  BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
  BUILTIN_NDA_TEMPLATE,
} from './template-sentinels'
import { api } from '../../../lib/api-client'
import type { AgreementType } from '../../../lib/api-client'
import type { EntityRef } from '../types'

export interface Step3Draft {
  titleOverride: string | null
  htmlOverride: string | null
  depositEnabledOverride: boolean | null
  depositAmountOverride: string | null
  internalNote: string
  /** Link validity in days, persisted with the agreement and reused by resend/extend. */
  expiryDays: number
}

/** Mirrors `MIN_EXPIRY_DAYS` / `MAX_EXPIRY_DAYS` on the server. Kept inline to
 *  avoid a workspace-package dependency on @ella/api types just for two ints. */
export const EXPIRY_DAYS_MIN = 1
export const EXPIRY_DAYS_MAX = 90
export const EXPIRY_DAYS_DEFAULT = 30
export const EXPIRY_DAYS_PRESETS = [7, 14, 30, 60, 90] as const

export const emptyStep3Draft: Step3Draft = {
  titleOverride: null,
  htmlOverride: null,
  depositEnabledOverride: null,
  depositAmountOverride: null,
  internalNote: '',
  expiryDays: EXPIRY_DAYS_DEFAULT,
}

export interface Step3Resolved {
  title: string
  contentHtml: string
  depositEnabled: boolean
  depositAmount: string
  internalNote: string
  expiryDays: number
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
const PLACEHOLDER_RE = /\[[^[\]\n]{2,120}\]/g

function defaultTitleFor(type: AgreementType, t: (k: string) => string): string {
  return t(`agreements.type.${type}`)
}

function findPlaceholders(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const text = doc.body.textContent ?? ''
  return Array.from(new Set(text.match(PLACEHOLDER_RE) ?? [])).slice(0, 10)
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

  const isBuiltinNda = templateId === BUILTIN_NDA_TEMPLATE
  const isBuiltinEngagementLetter = templateId === BUILTIN_ENGAGEMENT_LETTER_TEMPLATE
  const isBuiltinDefault = isBuiltinNda || isBuiltinEngagementLetter
  const isRealTemplate =
    !!templateId &&
    templateId !== BLANK_TEMPLATE &&
    templateId !== BUILTIN_NDA_TEMPLATE &&
    templateId !== BUILTIN_ENGAGEMENT_LETTER_TEMPLATE

  const defaultHtmlType = isBuiltinEngagementLetter ? 'ENGAGEMENT_LETTER' : 'NDA'

  // Default-HTML fetch — only when the user picked a synthetic built-in card.
  const defaultHtmlQuery = useAgreementDefaultHtml(entity, defaultHtmlType, isBuiltinDefault)

  // Template fetch — any agreement type when a real templateId was selected.
  const templateQuery = useQuery({
    queryKey: ['agreement-templates', 'detail', templateId],
    queryFn: () =>
      api.agreementTemplates.get(templateId as string).then((res) => res.data),
    enabled: isRealTemplate,
    staleTime: Infinity,
  })

  const seedHtml: string = isBuiltinDefault
    ? defaultHtmlQuery.data?.data.contentHtml ?? ''
    : isRealTemplate
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
    (isBuiltinDefault && defaultHtmlQuery.isLoading) ||
    (isRealTemplate && templateQuery.isLoading)
  const seedError =
    (isBuiltinDefault && defaultHtmlQuery.isError) ||
    (isRealTemplate && templateQuery.isError)

  const titleTrim = effectiveTitle.trim()
  const htmlTrim = effectiveHtml.trim()
  const depositValid =
    !effectiveDepositEnabled ||
    /^\d+(\.\d{1,2})?$/.test(effectiveDepositAmount.trim())
  const expiryValid =
    Number.isInteger(draft.expiryDays) &&
    draft.expiryDays >= EXPIRY_DAYS_MIN &&
    draft.expiryDays <= EXPIRY_DAYS_MAX
  const unresolvedPlaceholders =
    type === 'ENGAGEMENT_LETTER' ? findPlaceholders(effectiveHtml) : []
  const placeholdersResolved = unresolvedPlaceholders.length === 0
  const canSubmit =
    !!titleTrim &&
    htmlTrim.length > 0 &&
    depositValid &&
    expiryValid &&
    placeholdersResolved &&
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
      expiryDays: draft.expiryDays,
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

      {!placeholdersResolved && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {t('agreements.wizard.placeholdersUnresolved', {
            placeholders: unresolvedPlaceholders.join(', '),
          })}
        </div>
      )}

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

      <div className="block max-w-md">
        <span className="block text-xs font-medium text-muted-foreground mb-1">
          {t('agreements.wizard.fields.expiryDaysLabel')}
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="number"
            inputMode="numeric"
            min={EXPIRY_DAYS_MIN}
            max={EXPIRY_DAYS_MAX}
            step={1}
            value={draft.expiryDays}
            onChange={(e) => {
              const n = Number.parseInt(e.target.value, 10)
              patch({ expiryDays: Number.isFinite(n) ? n : EXPIRY_DAYS_DEFAULT })
            }}
            disabled={isSubmitting}
            className="w-24 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          <span className="text-sm text-muted-foreground">
            {t('agreements.wizard.fields.expiryDaysUnit')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {EXPIRY_DAYS_PRESETS.map((p) => {
              const active = draft.expiryDays === p
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => patch({ expiryDays: p })}
                  disabled={isSubmitting}
                  className={
                    'px-2.5 py-1 text-xs font-medium rounded-md border transition-colors disabled:opacity-50 ' +
                    (active
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-muted text-muted-foreground')
                  }
                >
                  {p}d
                </button>
              )
            })}
          </div>
        </div>
        {!expiryValid && (
          <span className="text-xs text-destructive mt-1 block">
            {t('agreements.wizard.fields.expiryDaysInvalid', {
              min: EXPIRY_DAYS_MIN,
              max: EXPIRY_DAYS_MAX,
            })}
          </span>
        )}
        <span className="block text-xs text-muted-foreground mt-1">
          {t('agreements.wizard.fields.expiryDaysHint')}
        </span>
      </div>

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
          className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <FileText className="w-4 h-4" />
          )}
          {t('nda.editor.previewAndSend')}
        </button>
      </div>

      <NdaPdfPreviewModal
        open={previewOpen}
        entity={entity}
        contentHtml={effectiveHtml}
        type={type}
        title={effectiveTitle}
        onClose={() => setPreviewOpen(false)}
        onSend={handleSubmit}
        isSending={isSubmitting}
      />
    </div>
  )
}
