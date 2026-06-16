import { useCallback, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, X } from 'lucide-react'
import {
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
import { api, type Lead } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import {
  buildEditLeadUpdatePayload,
  buildInitialEditLeadForm,
  canEditLeadPhone,
  validateEditLeadForm,
  type EditLeadFormData,
  type EditLeadFormErrors,
} from './edit-lead-modal-utils'
import { EditLeadModalFields } from './edit-lead-modal-fields'

interface EditLeadModalProps {
  lead: Lead
  isOpen: boolean
  onClose: () => void
}

export function EditLeadModal({ lead, isOpen, onClose }: EditLeadModalProps) {
  if (!isOpen) return null
  return <EditLeadModalContent lead={lead} onClose={onClose} />
}

function EditLeadModalContent({ lead, onClose }: Omit<EditLeadModalProps, 'isOpen'>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<EditLeadFormData>(() => buildInitialEditLeadForm(lead))
  const [errors, setErrors] = useState<EditLeadFormErrors>({})

  const initialForm = useMemo(() => buildInitialEditLeadForm(lead), [lead])
  const canEditPhone = canEditLeadPhone(initialForm.phone)
  const shouldSubmitPhone = canEditPhone && form.phone !== initialForm.phone

  const updateMutation = useMutation({
    mutationFn: () => {
      const payload = buildEditLeadUpdatePayload(form, initialForm, { canEditPhone })
      return api.leads.update(lead.id, payload)
    },
    onSuccess: async (response) => {
      queryClient.setQueryData(['lead', lead.id], response)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['lead', lead.id] }),
        queryClient.invalidateQueries({ queryKey: ['leads'] }),
        queryClient.invalidateQueries({ queryKey: ['lead-tags'] }),
      ])
      toast.success(t('leads.updateSuccess', 'Lead updated successfully'))
      onClose()
    },
    onError: (err) => {
      const message =
        err instanceof Error ? err.message : t('leads.updateError', 'Failed to update lead')
      setErrors((prev) => ({ ...prev, submit: message }))
      toast.error(message)
    },
  })

  const validate = useCallback(() => {
    const next = validateEditLeadForm(form, t, { validatePhone: shouldSubmitPhone })
    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, shouldSubmitPhone, t])

  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (updateMutation.isPending || !validate()) return
      updateMutation.mutate()
    },
    [updateMutation, validate]
  )

  const updateField = (key: keyof EditLeadFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined, submit: undefined }))
  }

  const isSaving = updateMutation.isPending

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      closeOnEscape={!isSaving}
      closeOnOverlayClick={!isSaving}
      showCloseButton={false}
      aria-labelledby="edit-lead-title"
      aria-describedby="edit-lead-description"
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader className="mb-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <ModalTitle id="edit-lead-title">{t('leads.editLead', 'Edit lead')}</ModalTitle>
              <ModalDescription id="edit-lead-description">
                {t('leads.editLeadDesc', 'Update contact details for this lead.')}
              </ModalDescription>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-full p-1 text-muted hover:bg-muted hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={t('common.close', 'Close')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </ModalHeader>

        <ModalBody className="space-y-3">
          <EditLeadModalFields
            form={form}
            errors={errors}
            isSaving={isSaving}
            canEditPhone={canEditPhone}
            updateField={updateField}
          />

          {errors.submit && (
            <p className="rounded-lg bg-error-light p-2 text-sm text-error" role="alert">
              {errors.submit}
            </p>
          )}
        </ModalBody>

        <ModalFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={isSaving}>
            {isSaving && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" aria-hidden="true" />}
            {isSaving ? t('common.saving', 'Saving...') : t('common.save', 'Save')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
