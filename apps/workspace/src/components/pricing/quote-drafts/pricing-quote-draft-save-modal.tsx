import { useId, useState, type FormEvent } from 'react'
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from '@ella/ui'

interface PricingQuoteDraftSaveModalProps {
  mode: 'save' | 'rename'
  initialName?: string
  isPending: boolean
  onClose: () => void
  onSave: (name: string) => Promise<void>
}

export function PricingQuoteDraftSaveModal({
  mode,
  initialName = '',
  isPending,
  onClose,
  onSave,
}: PricingQuoteDraftSaveModalProps) {
  const [name, setName] = useState(initialName)
  const [error, setError] = useState<string | null>(null)
  const id = useId()
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isPending) return
    if (!name.trim()) {
      setError('Draft name is required.')
      return
    }
    try {
      setError(null)
      await onSave(name.trim())
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save draft.')
    }
  }
  return (
    <Modal
      open
      onClose={() => {
        if (!isPending) onClose()
      }}
      showCloseButton={false}
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-description`}
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle id={`${id}-title`}>
            {mode === 'save' ? 'Save quote draft' : 'Rename quote draft'}
          </ModalTitle>
          <ModalDescription id={`${id}-description`}>
            Give this Calculator draft a name your team can recognize.
          </ModalDescription>
        </ModalHeader>
        <ModalBody>
          <label className="block text-xs font-medium text-foreground">
            Draft name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1"
              maxLength={120}
              disabled={isPending}
              autoFocus
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${id}-error` : undefined}
            />
          </label>
          {error && (
            <p id={`${id}-error`} role="alert" className="mt-2 text-xs text-error">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Saving...' : mode === 'save' ? 'Save draft' : 'Rename draft'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
