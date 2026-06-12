import { useState, type FormEvent } from 'react'
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
import { Loader2 } from 'lucide-react'

interface PaymentTemplateSaveModalProps {
  open: boolean
  isPending: boolean
  onClose: () => void
  onSave: (input: { name: string; description?: string }) => Promise<void>
}

export function PaymentTemplateSaveModal({
  open,
  isPending,
  onClose,
  onSave,
}: PaymentTemplateSaveModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const titleId = 'payment-template-save-title'
  const descriptionId = 'payment-template-save-description'

  const resetForm = () => {
    setName('')
    setDescription('')
    setError(null)
  }

  const handleClose = () => {
    if (isPending) return
    resetForm()
    onClose()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Template name is required.')
      return
    }

    try {
      setError(null)
      await onSave({
        name: trimmedName,
        ...(description.trim() ? { description: description.trim() } : {}),
      })
      resetForm()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not save payment template.')
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle id={titleId}>Save payment template</ModalTitle>
          <ModalDescription id={descriptionId}>
            Save these line items for everyone on your team. Recipient and discount choices are
            not saved.
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-3">
          <label className="block text-xs font-medium text-foreground">
            Template name
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1"
              maxLength={120}
              disabled={isPending}
              autoFocus
              placeholder="Monthly bookkeeping"
            />
          </label>
          <label className="block text-xs font-medium text-foreground">
            Description optional
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
              maxLength={500}
              disabled={isPending}
              placeholder="When to use this setup"
            />
          </label>
          {error && <p className="text-xs text-error">{error}</p>}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={handleClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save template
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
