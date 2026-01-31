/**
 * ReUploadRequestModal - Modal for requesting client to re-upload documents
 * Allows CPA to select reason, unreadable fields, customize message
 * Features: auto-generated Vietnamese SMS, SMS/note toggle
 */

import { useState, useMemo, useCallback, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  cn,
  Button,
  Badge,
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
} from '@ella/ui'
import { Loader2 } from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { getFieldLabel } from '../../lib/field-labels'
import { DOC_TYPE_FIELDS } from '../../lib/doc-type-fields'
import { api, type RawImage } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

export interface ReUploadRequestModalProps {
  /** Raw image that needs re-upload */
  image: RawImage
  /** Pre-selected unreadable fields from verification */
  unreadableFields?: string[]
  /** Whether modal is open */
  isOpen: boolean
  /** Callback when modal closes */
  onClose: () => void
  /** Case ID for query invalidation */
  caseId: string
}

type ReuploadReasonId = 'blurry' | 'partial' | 'wrong_type' | 'other'

// Re-upload reasons function - needs t() from component
function getReuploadReasons(t: (key: string) => string): Array<{ id: ReuploadReasonId; label: string }> {
  return [
    { id: 'blurry', label: t('reupload.reasonBlurry') },
    { id: 'partial', label: t('reupload.reasonPartial') },
    { id: 'wrong_type', label: t('reupload.reasonWrongType') },
    { id: 'other', label: t('reupload.reasonOther') },
  ]
}

export function ReUploadRequestModal({
  image,
  unreadableFields = [],
  isOpen,
  onClose,
  caseId,
}: ReUploadRequestModalProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const REUPLOAD_REASONS = getReuploadReasons(t)

  // Form state
  const [reason, setReason] = useState<ReuploadReasonId>('blurry')
  const [otherReason, setOtherReason] = useState('')
  const [selectedFields, setSelectedFields] = useState<string[]>(unreadableFields)
  const [customMessage, setCustomMessage] = useState('')
  const [sendMethod, setSendMethod] = useState<'sms' | 'note'>('sms')
  const [isEditingMessage, setIsEditingMessage] = useState(false)

  // Get available fields for this document type
  const availableFields = useMemo(() => {
    const docType = image.classifiedType || 'OTHER'
    return DOC_TYPE_FIELDS[docType] || DOC_TYPE_FIELDS.OTHER || []
  }, [image.classifiedType])

  // Generate Vietnamese message based on selections
  const generatedMessage = useMemo(() => {
    const docTypeLabel = image.classifiedType
      ? DOC_TYPE_LABELS[image.classifiedType] || image.classifiedType
      : 'tài liệu'

    // Get reason text
    const reasonObj = REUPLOAD_REASONS.find((r) => r.id === reason)
    const reasonText = reason === 'other'
      ? otherReason
      : reasonObj?.label.toLowerCase() || ''

    // Format field list
    const fieldLabels = selectedFields.map((f) => getFieldLabel(f))
    const fieldList = fieldLabels.length > 0
      ? fieldLabels.join(', ')
      : 'các trường cần thiết'

    return t('reupload.messageTemplate', {
      docType: docTypeLabel,
      reason: reasonText,
      fields: fieldList
    })
  }, [image.classifiedType, reason, otherReason, selectedFields])

  // Final message (custom or generated)
  const finalMessage = customMessage || generatedMessage

  // Toggle field selection
  const toggleField = useCallback((field: string) => {
    setSelectedFields((prev) =>
      prev.includes(field)
        ? prev.filter((f) => f !== field)
        : [...prev, field]
    )
  }, [])

  // Request reupload mutation
  const requestMutation = useMutation({
    mutationFn: () => {
      const reasonToSend = reason === 'other' ? otherReason : reason
      return api.images.requestReupload(image.id, {
        reason: reasonToSend,
        fields: selectedFields,
        sendSms: sendMethod === 'sms',
      })
    },
    onSuccess: (data) => {
      const message = data.smsSent
        ? t('reupload.successWithSMS')
        : t('reupload.success')
      toast.success(message)
      queryClient.invalidateQueries({ queryKey: ['case', caseId] })
      onClose()
    },
    onError: () => {
      toast.error(t('reupload.error'))
    },
  })

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (selectedFields.length === 0) {
      toast.error(t('reupload.selectFields'))
      return
    }
    requestMutation.mutate()
  }, [selectedFields, requestMutation, t])

  // Reset form when modal opens
  // Note: setState is intentional here to sync internal state with prop changes
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (isOpen) {
      setReason('blurry')
      setOtherReason('')
      setSelectedFields(unreadableFields)
      setCustomMessage('')
      setSendMethod('sms')
      setIsEditingMessage(false)
    }
  }, [isOpen, unreadableFields])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Document type label
  const docTypeLabel = image.classifiedType
    ? DOC_TYPE_LABELS[image.classifiedType] || image.classifiedType
    : t('reupload.unidentified')

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      size="lg"
      aria-labelledby="reupload-modal-title"
      aria-describedby="reupload-modal-description"
    >
      <ModalHeader>
        <ModalTitle id="reupload-modal-title">{t('reupload.title')}</ModalTitle>
        <ModalDescription id="reupload-modal-description">
          {t('reupload.document')}: {docTypeLabel}
        </ModalDescription>
      </ModalHeader>

      <ModalBody className="space-y-4">
        {/* Reason selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('reupload.reasonLabel')}
          </label>
          <div className="space-y-2">
            {REUPLOAD_REASONS.map((r) => (
              <label
                key={r.id}
                className={cn(
                  'flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors',
                  reason === r.id
                    ? 'border-primary bg-primary-light/20'
                    : 'border-border hover:bg-muted/50'
                )}
              >
                <input
                  type="radio"
                  name="reason"
                  value={r.id}
                  checked={reason === r.id}
                  onChange={() => setReason(r.id)}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm text-foreground">{r.label}</span>
              </label>
            ))}
          </div>
          {reason === 'other' && (
            <input
              type="text"
              placeholder={t('reupload.otherReasonPlaceholder')}
              value={otherReason}
              onChange={(e) => setOtherReason(e.target.value)}
              className="mt-2 w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          )}
        </div>

        {/* Field selection */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('reupload.unreadableFields')}
          </label>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('reupload.selectFields')}>
            {availableFields.map((field) => {
              const isSelected = selectedFields.includes(field)
              return (
                <Badge
                  key={field}
                  variant={isSelected ? 'default' : 'outline'}
                  className={cn(
                    'cursor-pointer transition-colors focus:ring-2 focus:ring-primary focus:outline-none',
                    isSelected
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                  onClick={() => toggleField(field)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggleField(field)
                    }
                  }}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  data-testid={`field-badge-${field}`}
                >
                  {getFieldLabel(field)}
                </Badge>
              )
            })}
          </div>
          {availableFields.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              {t('reupload.noFieldsAvailable')}
            </p>
          )}
        </div>

        {/* Message preview/edit */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-foreground">
              {t('reupload.messageLabel')}
            </label>
            <button
              type="button"
              onClick={() => {
                if (isEditingMessage) {
                  setCustomMessage('') // Reset to auto-generated
                }
                setIsEditingMessage(!isEditingMessage)
              }}
              className="text-xs text-primary hover:underline"
            >
              {isEditingMessage ? t('reupload.useAutoMessage') : t('reupload.editMessage')}
            </button>
          </div>
          {isEditingMessage ? (
            <textarea
              value={customMessage || generatedMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-border rounded-lg bg-card text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          ) : (
            <div className="p-3 bg-muted/50 rounded-lg text-sm text-foreground">
              {finalMessage}
            </div>
          )}
        </div>

        {/* Send method */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            {t('reupload.sendMethod')}
          </label>
          <div className="flex gap-4">
            <label
              className={cn(
                'flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-colors',
                sendMethod === 'sms'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              )}
            >
              <input
                type="radio"
                name="sendMethod"
                value="sms"
                checked={sendMethod === 'sms'}
                onChange={() => setSendMethod('sms')}
                className="sr-only"
              />
              <span className="text-sm font-medium">SMS</span>
            </label>
            <label
              className={cn(
                'flex items-center gap-2 px-4 py-2 border rounded-full cursor-pointer transition-colors',
                sendMethod === 'note'
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border hover:bg-muted'
              )}
            >
              <input
                type="radio"
                name="sendMethod"
                value="note"
                checked={sendMethod === 'note'}
                onChange={() => setSendMethod('note')}
                className="sr-only"
              />
              <span className="text-sm font-medium">{t('reupload.noteOnly')}</span>
            </label>
          </div>
          {sendMethod === 'note' && (
            <p className="text-xs text-muted-foreground mt-2">
              {t('reupload.noteOnlyDesc')}
            </p>
          )}
        </div>
      </ModalBody>

      <ModalFooter>
        <Button variant="outline" onClick={onClose}>
          {t('reupload.cancel')}
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={requestMutation.isPending || selectedFields.length === 0}
        >
          {requestMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              {t('reupload.sending')}
            </>
          ) : (
            t('reupload.sendRequest')
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
