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
 * default), deposit amount (from template default or constant), link expiry.
 *
 * Validation is UX-only — server is source of truth.
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Plus, Trash2 } from 'lucide-react'
import { RichTextEditor } from '../../leads/rich-text-editor'
import { NdaPdfPreviewModal } from '../agreement-pdf-preview-modal'
import { useAgreementDefaultHtml } from '../use-agreement-default-html'
import type { AgreementDraftAutosaveState } from '../use-agreement-draft-autosave'
import { AgreementEditorActions } from './agreement-editor-actions'
import {
  BLANK_TEMPLATE,
  BUILTIN_ENGAGEMENT_LETTER_TEMPLATE,
  BUILTIN_NDA_TEMPLATE,
} from './template-sentinels'
import {
  formatPaymentAmountInput,
  sanitizePaymentAmountInput,
} from './initial-payment-amount'
import { api } from '../../../lib/api-client'
import type { AgreementType } from '../../../lib/api-client'
import type { EntityRef } from '../types'

export interface Step3Draft {
  titleOverride: string | null
  htmlOverride: string | null
  placeholderValues: Record<string, string>
  serviceItems: string[]
  appliedPlaceholderValues: Record<string, string>
  appliedServiceItems: string[]
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
  placeholderValues: {},
  serviceItems: [],
  appliedPlaceholderValues: {},
  appliedServiceItems: [],
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
  onSaveDraft?: (resolved: Step3Resolved) => void
  draftSaveState?: AgreementDraftAutosaveState
  draftMetadata?: string | null
  isDraftSaved?: boolean
  conflictMessage?: string | null
  sendBlockedReason?: string | null
  onReloadDraft?: () => void
}

const DEFAULT_DEPOSIT_AMOUNT = '500.00'
/** Mirrors server-side `AGREEMENT_HTML_MAX_LENGTH` to avoid round-trip 422s. */
const HTML_MAX = 50_000
const PLACEHOLDER_RE = /\[[^[\]\n]{2,120}\]/g
const SCOPE_DESCRIPTION_PLACEHOLDER = '[Describe specific scope of work here.]'
const SERVICE_ITEM_PLACEHOLDER_RE = /^\[Service item (\d+)\]$/

function defaultTitleFor(type: AgreementType, t: (k: string) => string): string {
  return t(`agreements.type.${type}`)
}

function findPlaceholders(html: string): string[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const text = doc.body.textContent ?? ''
  return Array.from(new Set(text.match(PLACEHOLDER_RE) ?? []))
}

function uniquePlaceholders(placeholders: string[]): string[] {
  return Array.from(new Set(placeholders))
}

function placeholderLabel(token: string): string {
  return token.replace(/^\[/, '').replace(/\]$/, '')
}

function serviceItemIndex(token: string): number | null {
  const match = token.match(SERVICE_ITEM_PLACEHOLDER_RE)
  return match ? Number.parseInt(match[1], 10) : null
}

function isServiceItemPlaceholder(token: string): boolean {
  return serviceItemIndex(token) !== null
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function applyPlaceholderValues(
  html: string,
  values: Record<string, string>,
): string {
  return Object.entries(values).reduce((nextHtml, [token, rawValue]) => {
    const value = rawValue.trim()
    if (!value) return nextHtml
    return nextHtml.replaceAll(token, escapeHtml(value))
  }, html)
}

function applyServiceItemsToHtml(html: string, serviceItems: string[]): string {
  const items = serviceItems.map((item) => item.trim()).filter(Boolean)
  if (items.length === 0) return html

  const doc = new DOMParser().parseFromString(
    `<div data-agreement-root="true">${html}</div>`,
    'text/html',
  )
  const root = doc.querySelector('[data-agreement-root="true"]')
  if (!root) return html

  const serviceList = Array.from(root.querySelectorAll('ul')).find((list) =>
    Array.from(list.querySelectorAll('li')).some((item) =>
      SERVICE_ITEM_PLACEHOLDER_RE.test(item.textContent?.trim() ?? ''),
    ),
  )

  if (!serviceList) return html

  serviceList.replaceChildren(
    ...items.map((item) => {
      const li = doc.createElement('li')
      li.textContent = item
      return li
    }),
  )

  return root.innerHTML
}

function applyEngagementPlaceholderValues(
  html: string,
  values: Record<string, string>,
  serviceItems: string[],
): string {
  const textValues = { ...values }
  for (const token of Object.keys(textValues)) {
    if (isServiceItemPlaceholder(token)) delete textValues[token]
  }
  return applyPlaceholderValues(
    applyServiceItemsToHtml(html, serviceItems),
    textValues,
  )
}

function replaceTextInHtmlOnce(html: string, from: string, to: string): string {
  const oldValue = from.trim()
  const newValue = to.trim()
  if (!oldValue || oldValue === newValue) return html

  const doc = new DOMParser().parseFromString(
    `<div data-agreement-root="true">${html}</div>`,
    'text/html',
  )
  const root = doc.querySelector('[data-agreement-root="true"]')
  if (!root) return html

  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node) {
    const text = node.textContent ?? ''
    if (text.includes(oldValue)) {
      node.textContent = text.replace(oldValue, newValue)
      break
    }
    node = walker.nextNode()
  }

  return root.innerHTML
}

function replaceAppliedServiceItemsInHtml(
  html: string,
  previousItems: string[],
  nextItems: string[],
): string {
  const oldItems = previousItems.map((item) => item.trim()).filter(Boolean)
  const newItems = nextItems.map((item) => item.trim()).filter(Boolean)
  if (oldItems.length === 0 || newItems.length === 0) return html
  if (oldItems.length === newItems.length && oldItems.every((item, index) => item === newItems[index])) {
    return html
  }

  const doc = new DOMParser().parseFromString(
    `<div data-agreement-root="true">${html}</div>`,
    'text/html',
  )
  const root = doc.querySelector('[data-agreement-root="true"]')
  if (!root) return html

  const serviceList = Array.from(root.querySelectorAll('ul')).find((list) => {
    const texts = Array.from(list.querySelectorAll('li')).map((item) =>
      item.textContent?.trim() ?? '',
    )
    return oldItems.every((item) => texts.includes(item))
  })

  if (!serviceList) return html

  serviceList.replaceChildren(
    ...newItems.map((item) => {
      const li = doc.createElement('li')
      li.textContent = item
      return li
    }),
  )

  return root.innerHTML
}

function replaceAppliedPlaceholderValues(
  html: string,
  previousValues: Record<string, string>,
  nextValues: Record<string, string>,
  previousServiceItems: string[],
  nextServiceItems: string[],
): string {
  const nextHtml = Object.entries(nextValues).reduce((currentHtml, [token, value]) => {
    if (isServiceItemPlaceholder(token)) return currentHtml
    return replaceTextInHtmlOnce(currentHtml, previousValues[token] ?? '', value)
  }, html)

  return replaceAppliedServiceItemsInHtml(
    nextHtml,
    previousServiceItems,
    nextServiceItems,
  )
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
  onSaveDraft,
  draftSaveState,
  draftMetadata,
  isDraftSaved,
  conflictMessage,
  sendBlockedReason,
  onReloadDraft,
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
  const editablePlaceholders =
    type === 'ENGAGEMENT_LETTER'
      ? uniquePlaceholders([
          ...findPlaceholders(seedHtml),
          ...unresolvedPlaceholders,
          ...Object.keys(draft.placeholderValues),
          ...Object.keys(draft.appliedPlaceholderValues),
        ])
      : []
  const servicePlaceholders = editablePlaceholders
    .filter(isServiceItemPlaceholder)
    .sort((a, b) => (serviceItemIndex(a) ?? 0) - (serviceItemIndex(b) ?? 0))
  const hasScopeDescription = editablePlaceholders.includes(SCOPE_DESCRIPTION_PLACEHOLDER)
  const hasScopeBuilder =
    hasScopeDescription || servicePlaceholders.length > 0
  const standardPlaceholders = editablePlaceholders.filter(
    (placeholder) =>
      placeholder !== SCOPE_DESCRIPTION_PLACEHOLDER &&
      !isServiceItemPlaceholder(placeholder),
  )
  const serviceItems =
    draft.serviceItems.length > 0
      ? draft.serviceItems
      : servicePlaceholders.map((placeholder) => draft.placeholderValues[placeholder] ?? '')
  const visibleServiceItems = serviceItems.length > 0 ? serviceItems : ['']
  const placeholdersResolved = unresolvedPlaceholders.length === 0
  const filledStandardPlaceholderCount = standardPlaceholders.filter(
    (placeholder) => draft.placeholderValues[placeholder]?.trim(),
  ).length
  const filledScopeDescriptionCount =
    hasScopeBuilder && draft.placeholderValues[SCOPE_DESCRIPTION_PLACEHOLDER]?.trim()
      ? 1
      : 0
  const filledServiceCount = hasScopeBuilder
    ? visibleServiceItems.filter((item) => item.trim()).length
    : 0
  const placeholderInputCount =
    standardPlaceholders.length +
    (hasScopeDescription ? 1 : 0) +
    (hasScopeBuilder ? Math.max(1, visibleServiceItems.length) : 0)
  const filledPlaceholderCount =
    filledStandardPlaceholderCount + filledScopeDescriptionCount + filledServiceCount
  const nextServiceItems = visibleServiceItems.map((item) => item.trim()).filter(Boolean)
  const appliedServiceItems = draft.appliedServiceItems.map((item) => item.trim()).filter(Boolean)
  const standardValuesChanged = editablePlaceholders.some(
    (placeholder) =>
      (draft.placeholderValues[placeholder] ?? '').trim() !==
      (draft.appliedPlaceholderValues[placeholder] ?? '').trim(),
  )
  const serviceItemsChanged =
    nextServiceItems.length !== appliedServiceItems.length ||
    nextServiceItems.some((item, index) => item !== appliedServiceItems[index])
  const showPlaceholderPanel = editablePlaceholders.length > 0
  const hasUnappliedPlaceholderChanges =
    showPlaceholderPanel &&
    placeholdersResolved &&
    (standardValuesChanged || serviceItemsChanged)
  const canApplyPlaceholders =
    filledPlaceholderCount > 0 &&
    !isSubmitting &&
    (unresolvedPlaceholders.length > 0 || standardValuesChanged || serviceItemsChanged)
  const canSubmit =
    !!titleTrim &&
    htmlTrim.length > 0 &&
    depositValid &&
    expiryValid &&
    placeholdersResolved &&
    !hasUnappliedPlaceholderChanges &&
    !seedLoading &&
    !seedError &&
    !isSubmitting

  const resolveCurrentDraft = (): Step3Resolved => ({
      title: titleTrim,
      contentHtml: effectiveHtml,
      depositEnabled: effectiveDepositEnabled,
      depositAmount: effectiveDepositAmount.trim(),
      internalNote: draft.internalNote,
      expiryDays: draft.expiryDays,
  })

  const handleSubmit = () => {
    if (!canSubmit || sendBlockedReason) return
    onSubmit(resolveCurrentDraft())
  }

  const handleSaveDraft = () => {
    if (!canSubmit || !onSaveDraft) return
    onSaveDraft(resolveCurrentDraft())
  }

  const patchPlaceholderValue = (placeholder: string, value: string) => {
    patch({
      placeholderValues: {
        ...draft.placeholderValues,
        [placeholder]: value,
      },
    })
  }

  const patchServiceItem = (index: number, value: string) => {
    patch({
      serviceItems: visibleServiceItems.map((item, itemIndex) =>
        itemIndex === index ? value : item,
      ),
    })
  }

  const handleAddServiceItem = () => {
    patch({ serviceItems: [...visibleServiceItems, ''] })
  }

  const handleRemoveServiceItem = (index: number) => {
    const next = visibleServiceItems.filter((_, itemIndex) => itemIndex !== index)
    patch({ serviceItems: next.length > 0 ? next : [''] })
  }

  const handleApplyPlaceholders = () => {
    if (!canApplyPlaceholders) return
    const nextHtml =
      unresolvedPlaceholders.length > 0
        ? applyEngagementPlaceholderValues(
            effectiveHtml,
            draft.placeholderValues,
            visibleServiceItems,
          )
        : replaceAppliedPlaceholderValues(
            effectiveHtml,
            draft.appliedPlaceholderValues,
            draft.placeholderValues,
            draft.appliedServiceItems,
            visibleServiceItems,
          )
    patch({
      htmlOverride: nextHtml,
      appliedPlaceholderValues: { ...draft.placeholderValues },
      appliedServiceItems: nextServiceItems,
    })
  }

  return (
    <div className="grid gap-5 xl:h-full xl:min-h-0 xl:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="min-w-0 space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
        <label className="block rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            {t('agreements.wizard.fields.titleLabel')}
          </span>
          <input
            type="text"
            value={effectiveTitle}
            onChange={(e) => patch({ titleOverride: e.target.value })}
            maxLength={200}
            disabled={isSubmitting}
            placeholder={t('agreements.wizard.fields.titlePlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
          />
        </label>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t('agreements.wizard.fields.contentLabel')}
            </span>
            {!placeholdersResolved && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                {t('agreements.wizard.placeholderPanel.progress', {
                  filled: filledPlaceholderCount,
                  total: placeholderInputCount,
                })}
              </span>
            )}
          </div>
          {seedLoading ? (
            <div className="flex items-center justify-center min-h-[420px] rounded-lg border border-border bg-muted/20">
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
              className="min-h-[420px]"
            />
          )}
        </div>
      </div>

      <aside className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
        {showPlaceholderPanel && (
          <div className="rounded-xl border border-primary/20 bg-card p-4 text-sm shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">
                  {t('agreements.wizard.placeholderPanel.title')}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t('agreements.wizard.placeholderPanel.description')}
                </p>
              </div>
              <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {t('agreements.wizard.placeholderPanel.progress', {
                  filled: filledPlaceholderCount,
                  total: placeholderInputCount,
                })}
              </span>
            </div>

            <div className="mt-4 space-y-4">
              {hasScopeBuilder && (
                <div className="rounded-lg border border-border bg-background/60 p-3">
                  {hasScopeDescription && (
                    <label className="block">
                      <span className="block text-xs font-semibold text-foreground mb-1">
                        {t('agreements.wizard.serviceBuilder.scopeLabel')}
                      </span>
                      <textarea
                        value={draft.placeholderValues[SCOPE_DESCRIPTION_PLACEHOLDER] ?? ''}
                        onChange={(e) =>
                          patchPlaceholderValue(SCOPE_DESCRIPTION_PLACEHOLDER, e.target.value)
                        }
                        rows={3}
                        disabled={isSubmitting}
                        placeholder={t('agreements.wizard.serviceBuilder.scopePlaceholder')}
                        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                      />
                    </label>
                  )}

                  <div className={hasScopeDescription ? 'mt-3' : ''}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground">
                        {t('agreements.wizard.serviceBuilder.itemsLabel')}
                      </span>
                      <button
                        type="button"
                        onClick={handleAddServiceItem}
                        disabled={isSubmitting}
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        {t('agreements.wizard.serviceBuilder.add')}
                      </button>
                    </div>

                    <div className="space-y-2">
                      {visibleServiceItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                            {index + 1}
                          </span>
                          <input
                            type="text"
                            value={item}
                            onChange={(e) => patchServiceItem(index, e.target.value)}
                            disabled={isSubmitting}
                            placeholder={t('agreements.wizard.serviceBuilder.itemPlaceholder', {
                              index: index + 1,
                            })}
                            className="min-h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveServiceItem(index)}
                            disabled={isSubmitting || visibleServiceItems.length === 1}
                            aria-label={t('agreements.wizard.serviceBuilder.remove')}
                            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-destructive disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {standardPlaceholders.map((placeholder) => {
                const label = placeholderLabel(placeholder)
                return (
                  <label key={placeholder} className="block">
                    <span className="block text-xs font-medium text-muted-foreground mb-1">
                      {label}
                    </span>
                    <input
                      type="text"
                      value={draft.placeholderValues[placeholder] ?? ''}
                      onChange={(e) => patchPlaceholderValue(placeholder, e.target.value)}
                      disabled={isSubmitting}
                      placeholder={t('agreements.wizard.placeholderPanel.fieldPlaceholder', {
                        label,
                      })}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
                    />
                  </label>
                )
              })}
            </div>

            <div className="mt-4 space-y-3">
              {!placeholdersResolved && (
                <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">
                  {t('agreements.wizard.placeholdersUnresolved', {
                    placeholders: unresolvedPlaceholders.join(', '),
                  })}
                </p>
              )}
              {hasUnappliedPlaceholderChanges && (
                <p className="rounded-lg bg-primary/10 px-3 py-2 text-xs leading-5 text-primary">
                  {t('agreements.wizard.placeholderPanel.unappliedChanges')}
                </p>
              )}
              <button
                type="button"
                onClick={handleApplyPlaceholders}
                disabled={!canApplyPlaceholders}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:hover:bg-primary"
              >
                <Check className="w-4 h-4" />
                {t('agreements.wizard.placeholderPanel.apply')}
              </button>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {t('agreements.wizard.sendSettingsTitle')}
          </p>

          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={effectiveDepositEnabled}
              onChange={(e) => patch({ depositEnabledOverride: e.target.checked })}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
            />
            <span className="text-sm text-foreground">
              {t('agreements.wizard.fields.depositToggle')}
              <span className="block text-xs leading-5 text-muted-foreground">
                {t('agreements.wizard.fields.depositToggleHint')}
              </span>
            </span>
          </label>

          {effectiveDepositEnabled && (
            <label className="mt-4 block">
              <span className="block text-xs font-medium text-muted-foreground mb-1">
                {t('agreements.wizard.fields.depositAmountLabel')}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formatPaymentAmountInput(effectiveDepositAmount)}
                onChange={(e) =>
                  patch({ depositAmountOverride: sanitizePaymentAmountInput(e.target.value) })
                }
                disabled={isSubmitting}
                placeholder="$500.00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              />
              {!depositValid && (
                <span className="text-xs text-destructive mt-1 block">
                  {t('agreements.wizard.fields.depositAmountInvalid')}
                </span>
              )}
            </label>
          )}

          <div className="mt-4">
            <span className="block text-xs font-medium text-muted-foreground mb-1">
              {t('agreements.wizard.fields.expiryDaysLabel')}
            </span>
            <div className="flex items-center gap-2">
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
                className="h-11 w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">
                {t('agreements.wizard.fields.expiryDaysUnit')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXPIRY_DAYS_PRESETS.map((p) => {
                const active = draft.expiryDays === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => patch({ expiryDays: p })}
                    disabled={isSubmitting}
                    className={
                      'min-h-9 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 ' +
                      (active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted')
                    }
                  >
                    {p}d
                  </button>
                )
              })}
            </div>
            {!expiryValid && (
              <span className="text-xs text-destructive mt-1 block">
                {t('agreements.wizard.fields.expiryDaysInvalid', {
                  min: EXPIRY_DAYS_MIN,
                  max: EXPIRY_DAYS_MAX,
                })}
              </span>
            )}
            <span className="block text-xs leading-5 text-muted-foreground mt-1">
              {t('agreements.wizard.fields.expiryDaysHint')}
            </span>
          </div>

          <AgreementEditorActions
            canSubmit={canSubmit}
            isSubmitting={isSubmitting}
            isDraftSaved={isDraftSaved}
            draftSaveState={draftSaveState}
            draftMetadata={draftMetadata}
            conflictMessage={conflictMessage}
            sendBlockedReason={sendBlockedReason}
            onOpenPreview={() => setPreviewOpen(true)}
            onCancel={onCancel}
            onSaveDraft={onSaveDraft ? handleSaveDraft : undefined}
            onReloadDraft={onReloadDraft}
            t={t}
          />
        </div>
      </aside>

      <NdaPdfPreviewModal
        open={previewOpen}
        entity={entity}
        contentHtml={effectiveHtml}
        type={type}
        title={effectiveTitle}
        onClose={() => setPreviewOpen(false)}
        onSend={handleSubmit}
        isSending={isSubmitting}
        sendDisabledReason={sendBlockedReason}
      />
    </div>
  )
}
