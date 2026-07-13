import { useState, type FormEvent } from 'react'
import { Loader2, Plus } from 'lucide-react'
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
import type { CreateClientServiceLogInput } from '../../../lib/api-client'
import { ServiceLogFormFields } from './service-log-form-fields'
import {
  buildServiceLogPayload,
  getDefaultFormValues,
  type ServiceLogFormFieldChange,
} from './service-log-form-utils'

type ServiceLogQuickAddProps = {
  defaultTaxYear?: number | null
  isSubmitting: boolean
  onSubmit: (payload: CreateClientServiceLogInput) => Promise<void>
}

export function ServiceLogQuickAdd({
  defaultTaxYear,
  isSubmitting,
  onSubmit,
}: ServiceLogQuickAddProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [values, setValues] = useState(() => getDefaultFormValues(defaultTaxYear))
  const [error, setError] = useState<string | null>(null)

  const setField: ServiceLogFormFieldChange = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(null)
  }

  const resetForm = () => {
    setValues(getDefaultFormValues(defaultTaxYear))
    setError(null)
  }

  const handleOpen = () => {
    resetForm()
    setIsOpen(true)
  }

  const handleClose = () => {
    if (isSubmitting) return
    setIsOpen(false)
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
      await onSubmit(result.payload)
      resetForm()
      setIsOpen(false)
    } catch {
      setError(t('clientServices.createError'))
    }
  }

  return (
    <>
      <Button type="button" onClick={handleOpen} className="min-h-11">
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {t('clientServices.addService')}
      </Button>

      <Modal
        open={isOpen}
        onClose={handleClose}
        size="lg"
        aria-labelledby="client-service-add-title"
        aria-describedby="client-service-add-description"
        closeOnOverlayClick={!isSubmitting}
        closeOnEscape={!isSubmitting}
        showCloseButton={!isSubmitting}
      >
        <ModalHeader>
          <ModalTitle id="client-service-add-title">
            {t('clientServices.addService')}
          </ModalTitle>
          <ModalDescription id="client-service-add-description">
            {t('clientServices.quickAddDescription')}
          </ModalDescription>
        </ModalHeader>

        <form onSubmit={handleSubmit}>
          <ModalBody className="space-y-3">
            <ServiceLogFormFields
              values={values}
              onChange={setField}
              noteId="client-service-add-note"
              noteRows={5}
            />

            {error && (
              <p aria-live="polite" className="text-xs font-medium text-destructive">
                {error}
              </p>
            )}
          </ModalBody>

          <ModalFooter className="flex-wrap">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isSubmitting}
              className="min-h-11"
            >
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="min-h-11">
              {isSubmitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {isSubmitting ? t('clientServices.adding') : t('clientServices.addService')}
            </Button>
          </ModalFooter>
        </form>
      </Modal>
    </>
  )
}
