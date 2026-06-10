/**
 * Wizard Step 3 (upload variant) — used when the user picked "Upload PDF" in
 * Step 2. Instead of the rich-text editor, the staff uploads a finished PDF
 * which becomes the agreement body verbatim; at signing the server appends a
 * generated Acceptance & Signature page.
 *
 * Flow: pick file → POST /agreements/upload-pdf (returns key + preview URL) →
 * preview inline → set title / deposit / expiry → send (create with uploadedPdfKey).
 */
import { useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileText, Loader2, Upload, X } from 'lucide-react'
import { agreementsApi } from '../use-agreement-mutations'
import { toast } from '../../../stores/toast-store'
import {
  EXPIRY_DAYS_DEFAULT,
  EXPIRY_DAYS_MAX,
  EXPIRY_DAYS_MIN,
  EXPIRY_DAYS_PRESETS,
} from './step3-content-editor'
import {
  formatPaymentAmountInput,
  sanitizePaymentAmountInput,
} from './initial-payment-amount'
import type { AgreementType, UploadedPdfResult } from '../../../lib/api-client'
import type { EntityRef } from '../types'

const MAX_PDF_BYTES = 15 * 1024 * 1024
const DEFAULT_DEPOSIT_AMOUNT = '500.00'

export interface UploadStep3Resolved {
  uploadedPdfKey: string
  title: string
  depositEnabled: boolean
  depositAmount: string
  expiryDays: number
}

interface Props {
  entity: EntityRef
  type: AgreementType
  isSubmitting: boolean
  onCancel: () => void
  onSubmit: (resolved: UploadStep3Resolved) => void
}

export function Step3UploadEditor({ entity, type, isSubmitting, onCancel, onSubmit }: Props) {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [uploaded, setUploaded] = useState<UploadedPdfResult | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [title, setTitle] = useState<string>(t(`agreements.type.${type}`))
  const [depositEnabled, setDepositEnabled] = useState(false)
  const [depositAmount, setDepositAmount] = useState(DEFAULT_DEPOSIT_AMOUNT)
  const [expiryDays, setExpiryDays] = useState(EXPIRY_DAYS_DEFAULT)

  const uploadMutation = useMutation({
    mutationFn: (file: File) => agreementsApi(entity).uploadPdf(entity.id, file),
    onSuccess: (data) => setUploaded(data),
    onError: (err: Error) => {
      setFileName('')
      toast.error(err.message || t('agreements.wizard.upload.failed'))
    },
  })

  const handleFile = (file: File | undefined) => {
    if (!file) return
    if (file.type !== 'application/pdf') {
      toast.error(t('agreements.wizard.upload.notPdf'))
      return
    }
    if (file.size > MAX_PDF_BYTES) {
      toast.error(t('agreements.wizard.upload.tooLarge'))
      return
    }
    setFileName(file.name)
    setUploaded(null)
    uploadMutation.mutate(file)
  }

  const depositValid = !depositEnabled || /^\d+(\.\d{1,2})?$/.test(depositAmount.trim())
  const expiryValid =
    Number.isInteger(expiryDays) && expiryDays >= EXPIRY_DAYS_MIN && expiryDays <= EXPIRY_DAYS_MAX
  const canSubmit =
    !!uploaded &&
    !!title.trim() &&
    depositValid &&
    expiryValid &&
    !uploadMutation.isPending &&
    !isSubmitting

  const handleSubmit = () => {
    if (!canSubmit || !uploaded) return
    onSubmit({
      uploadedPdfKey: uploaded.key,
      title: title.trim(),
      depositEnabled,
      depositAmount: depositAmount.trim(),
      expiryDays,
    })
  }

  return (
    <div className="grid gap-5 xl:h-[calc(92vh-8rem)] xl:min-h-0 xl:overflow-hidden xl:grid-cols-[minmax(0,1fr)_400px]">
      {/* ── Left: upload + preview ── */}
      <div className="min-w-0 space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {!uploaded && !uploadMutation.isPending && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-16 text-center transition-colors hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              <Upload className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold text-foreground">
              {t('agreements.wizard.upload.dropTitle')}
            </span>
            <span className="text-xs text-muted-foreground">
              {t('agreements.wizard.upload.dropHint')}
            </span>
          </button>
        )}

        {uploadMutation.isPending && (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 rounded-xl border border-border bg-muted/20">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {t('agreements.wizard.upload.uploading')}
            </span>
          </div>
        )}

        {uploaded && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
              <div className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="truncate text-sm font-medium text-foreground">{fileName}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {t('agreements.wizard.upload.pageCount', { count: uploaded.pageCount })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isSubmitting}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {t('agreements.wizard.upload.replace')}
              </button>
            </div>
            {uploaded.previewUrl && (
              <iframe
                title={t('agreements.wizard.upload.previewTitle')}
                // PDF open params hide the native viewer's thumbnail/page sidebar
                // (navpanes=0, pagemode=none) so the document gets full width.
                src={`${uploaded.previewUrl}#navpanes=0&pagemode=none&view=FitH`}
                className="h-[72vh] min-h-[480px] w-full rounded-xl border border-border bg-white xl:h-[calc(92vh-13rem)]"
              />
            )}
          </div>
        )}
      </div>

      {/* ── Right: metadata + send ── */}
      <aside className="space-y-4 xl:min-h-0 xl:overflow-y-auto xl:pr-2">
        <label className="block rounded-xl border border-border bg-card p-4 shadow-sm">
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t('agreements.wizard.fields.titleLabel')}
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={isSubmitting}
            placeholder={t('agreements.wizard.fields.titlePlaceholder')}
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          />
        </label>

        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <p className="text-sm font-semibold text-foreground">
            {t('agreements.wizard.sendSettingsTitle')}
          </p>

          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={depositEnabled}
              onChange={(e) => setDepositEnabled(e.target.checked)}
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

          {depositEnabled && (
            <label className="mt-4 block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                {t('agreements.wizard.fields.depositAmountLabel')}
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={formatPaymentAmountInput(depositAmount)}
                onChange={(e) => setDepositAmount(sanitizePaymentAmountInput(e.target.value))}
                disabled={isSubmitting}
                placeholder="$500.00"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              {!depositValid && (
                <span className="mt-1 block text-xs text-destructive">
                  {t('agreements.wizard.fields.depositAmountInvalid')}
                </span>
              )}
            </label>
          )}

          <div className="mt-4">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              {t('agreements.wizard.fields.expiryDaysLabel')}
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min={EXPIRY_DAYS_MIN}
                max={EXPIRY_DAYS_MAX}
                step={1}
                value={expiryDays}
                onChange={(e) => {
                  const n = Number.parseInt(e.target.value, 10)
                  setExpiryDays(Number.isFinite(n) ? n : EXPIRY_DAYS_DEFAULT)
                }}
                disabled={isSubmitting}
                className="h-11 w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
              />
              <span className="text-sm text-muted-foreground">
                {t('agreements.wizard.fields.expiryDaysUnit')}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {EXPIRY_DAYS_PRESETS.map((p) => {
                const active = expiryDays === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setExpiryDays(p)}
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
          </div>

          <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {t('agreements.wizard.upload.send')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="min-h-10 rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50"
            >
              <X className="mr-1 inline h-4 w-4" />
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
