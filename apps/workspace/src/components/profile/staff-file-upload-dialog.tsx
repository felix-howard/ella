import { type FormEvent, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Upload } from 'lucide-react'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
  Select,
} from '@ella/ui'
import type { StaffFileKind } from '../../lib/api-client'
import { useStaffFileUpload } from './use-staff-file-upload'

interface StaffFileUploadDialogProps {
  open: boolean
  onClose: () => void
  staffId: string
  kind: StaffFileKind
  defaultYear?: number
  defaultMonth?: number
  replacingExisting?: boolean
}

const monthOptions = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1
  return { value: String(month), label: new Date(2026, index, 1).toLocaleString(undefined, { month: 'long' }) }
})

export function StaffFileUploadDialog({
  open,
  onClose,
  staffId,
  kind,
  defaultYear,
  defaultMonth,
  replacingExisting,
}: StaffFileUploadDialogProps) {
  const { t } = useTranslation()
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [invoiceYear, setInvoiceYear] = useState(defaultYear ?? new Date().getFullYear())
  const [invoiceMonth, setInvoiceMonth] = useState(defaultMonth ?? new Date().getMonth() + 1)
  const [replacementConfirmed, setReplacementConfirmed] = useState(false)
  const upload = useStaffFileUpload({ staffId, kind, onSuccess: onClose })
  const { reset } = upload
  const isInvoice = kind === 'INVOICE'

  useEffect(() => {
    if (!open) return
    setFile(null)
    setTitle('')
    setCategory('')
    setInvoiceYear(defaultYear ?? new Date().getFullYear())
    setInvoiceMonth(defaultMonth ?? new Date().getMonth() + 1)
    setReplacementConfirmed(false)
    reset()
  }, [defaultMonth, defaultYear, open, reset])

  const canSubmit = useMemo(() => {
    if (!file || upload.isUploading) return false
    if (isInvoice && replacingExisting && !replacementConfirmed) return false
    return true
  }, [file, isInvoice, replacementConfirmed, replacingExisting, upload.isUploading])

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (!file) return
    const result = await upload.upload({
      file,
      title,
      category,
      invoiceYear: isInvoice ? invoiceYear : undefined,
      invoiceMonth: isInvoice ? invoiceMonth : undefined,
    })
    if (result) onClose()
  }

  const titleId = isInvoice ? 'staff-invoice-upload-title' : 'staff-document-upload-title'
  const descriptionId = isInvoice ? 'staff-invoice-upload-description' : 'staff-document-upload-description'

  return (
    <Modal
      open={open}
      onClose={upload.isUploading ? () => undefined : onClose}
      size="lg"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle id={titleId}>
            {isInvoice ? t('profile.staffFiles.addInvoice') : t('profile.staffFiles.addDocument')}
          </ModalTitle>
          <ModalDescription id={descriptionId}>
            {t('profile.staffFiles.uploadDescription')}
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-4">
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            disabled={upload.isUploading}
            required
          />

          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t('profile.staffFiles.title')}
            disabled={upload.isUploading}
          />

          <Input
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t('profile.staffFiles.category')}
            disabled={upload.isUploading}
          />

          {isInvoice && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                value={String(invoiceMonth)}
                onChange={(event) => setInvoiceMonth(Number(event.target.value))}
                options={monthOptions}
                aria-label={t('profile.staffFiles.invoiceMonth')}
                disabled={upload.isUploading}
              />
              <Input
                type="number"
                min={2000}
                max={2100}
                value={invoiceYear}
                onChange={(event) => setInvoiceYear(Number(event.target.value))}
                aria-label={t('profile.staffFiles.invoiceYear')}
                disabled={upload.isUploading}
              />
            </div>
          )}

          {isInvoice && replacingExisting && (
            <label className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <input
                type="checkbox"
                checked={replacementConfirmed}
                onChange={(event) => setReplacementConfirmed(event.target.checked)}
                disabled={upload.isUploading}
                className="mt-0.5"
              />
              <span>{t('profile.staffFiles.replaceConfirm')}</span>
            </label>
          )}

          {upload.error && <p className="text-sm text-destructive">{upload.error}</p>}
          {upload.isUploading && (
            <p className="text-sm text-muted-foreground">
              {t('profile.staffFiles.uploading', { progress: upload.progress })}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={upload.isUploading}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={!canSubmit}>
            {upload.isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {t('common.upload', 'Upload')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
