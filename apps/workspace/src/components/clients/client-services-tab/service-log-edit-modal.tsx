import { useState, type FormEvent } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  Button,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'
import type {
  ClientServiceLog,
  UpdateClientServiceLogInput,
} from '../../../lib/api-client'
import { ServiceLogFormFields } from './service-log-form-fields'
import {
  buildServiceLogPayload,
  getFormValuesFromLog,
  type ServiceLogFormFieldChange,
} from './service-log-form-utils'
import { getServiceLogTitle } from './service-log-labels'

type ServiceLogEditModalProps = {
  log: ClientServiceLog | null
  isSaving: boolean
  isDeleting: boolean
  onClose: () => void
  onSave: (serviceLogId: string, payload: UpdateClientServiceLogInput) => Promise<void>
  onDelete: (serviceLogId: string) => Promise<void>
}

export function ServiceLogEditModal(props: ServiceLogEditModalProps) {
  const { log, isSaving, isDeleting, onClose } = props
  if (!log) return null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      aria-labelledby="client-service-edit-title"
      closeOnOverlayClick={!isSaving && !isDeleting}
      closeOnEscape={!isSaving && !isDeleting}
      showCloseButton={!isSaving && !isDeleting}
    >
      <ServiceLogEditForm key={log.id} {...props} log={log} />
    </Modal>
  )
}

function ServiceLogEditForm({
  log,
  isSaving,
  isDeleting,
  onClose,
  onSave,
  onDelete,
}: Omit<ServiceLogEditModalProps, 'log'> & { log: ClientServiceLog }) {
  const { t } = useTranslation()
  const [values, setValues] = useState(() => getFormValuesFromLog(log))
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const setField: ServiceLogFormFieldChange = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const result = buildServiceLogPayload(values, t)
    if (result.error || !result.payload) {
      setError(result.error ?? t('clientServices.saveError'))
      return
    }

    try {
      await onSave(log.id, result.payload)
    } catch {
      setError(t('clientServices.updateError'))
    }
  }

  const handleDelete = async () => {
    try {
      await onDelete(log.id)
    } catch {
      setError(t('clientServices.deleteError'))
    }
  }

  return (
    <>
      <ModalHeader>
        <ModalTitle id="client-service-edit-title">{t('clientServices.editTitle')}</ModalTitle>
        <ModalDescription>{getServiceLogTitle(log, t)}</ModalDescription>
      </ModalHeader>

      <form onSubmit={handleSubmit}>
        <ModalBody className="space-y-3">
          <ServiceLogFormFields
            values={values}
            onChange={setField}
            noteId="client-service-edit-note"
            noteRows={5}
          />

          {error && (
            <p aria-live="polite" className="text-xs font-medium text-destructive">
              {error}
            </p>
          )}

          {confirmingDelete && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm font-medium text-destructive">
                {t('clientServices.deleteConfirmTitle')}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {t('clientServices.deleteConfirmDescription')}
              </p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setConfirmingDelete(false)}
                  className="min-h-11"
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="min-h-11"
                >
                  {isDeleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                  {t('clientServices.deleteService')}
                </Button>
              </div>
            </div>
          )}
        </ModalBody>

        <ModalFooter className="flex-wrap justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setConfirmingDelete(true)}
            disabled={isSaving || isDeleting || confirmingDelete}
            className="min-h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            {t('clientServices.delete')}
          </Button>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSaving || isDeleting}
              className="min-h-11"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving || isDeleting} className="min-h-11">
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
              {isSaving ? t('clientServices.saving') : t('clientServices.saveChanges')}
            </Button>
          </div>
        </ModalFooter>
      </form>
    </>
  )
}
