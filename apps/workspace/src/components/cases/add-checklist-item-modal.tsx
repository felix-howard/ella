/**
 * AddChecklistItemModal - Staff modal to manually add checklist items
 * Allows staff to add documents not auto-generated from intake
 */

import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
  Input,
  cn,
} from '@ella/ui'
import { ChevronDown } from 'lucide-react'
import { DOC_TYPE_LABELS } from '../../lib/constants'

interface AddChecklistItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { docType: string; reason?: string; expectedCount?: number }) => void
  existingDocTypes: string[]
  isSubmitting?: boolean
}

export function AddChecklistItemModal({
  isOpen,
  onClose,
  onSubmit,
  existingDocTypes,
  isSubmitting = false,
}: AddChecklistItemModalProps) {
  const { t } = useTranslation()
  const [docType, setDocType] = useState<string>('')
  const [reason, setReason] = useState('')
  const [expectedCount, setExpectedCount] = useState(1)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Filter out already-existing doc types
  const availableDocTypes = useMemo(() => {
    return Object.entries(DOC_TYPE_LABELS)
      .filter(([key]) => !existingDocTypes.includes(key))
      .sort((a, b) => a[1].localeCompare(b[1]))
  }, [existingDocTypes])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!docType) return

    onSubmit({
      docType,
      reason: reason || undefined,
      expectedCount: expectedCount > 1 ? expectedCount : undefined,
    })
  }

  const handleClose = () => {
    setDocType('')
    setReason('')
    setExpectedCount(1)
    setIsDropdownOpen(false)
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle>{t('addChecklistItem.title')}</ModalTitle>
          <ModalDescription>
            {t('addChecklistItem.description')}
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* Doc type select - custom dropdown */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('addChecklistItem.docType')} <span className="text-error">*</span>
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={isSubmitting || availableDocTypes.length === 0}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2.5 text-left',
                  'border border-border rounded-lg bg-background',
                  'hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20',
                  'disabled:opacity-50 disabled:cursor-not-allowed'
                )}
              >
                <span className={docType ? 'text-foreground' : 'text-muted-foreground'}>
                  {docType ? DOC_TYPE_LABELS[docType] || docType : t('addChecklistItem.selectDocType')}
                </span>
                <ChevronDown
                  className={cn(
                    'w-4 h-4 text-muted-foreground transition-transform',
                    isDropdownOpen && 'rotate-180'
                  )}
                />
              </button>

              {/* Dropdown list */}
              {isDropdownOpen && (
                <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-lg shadow-lg max-h-48 overflow-auto">
                  {availableDocTypes.map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setDocType(key)
                        setIsDropdownOpen(false)
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left text-sm hover:bg-muted transition-colors',
                        docType === key && 'bg-primary-light text-primary'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {availableDocTypes.length === 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                {t('addChecklistItem.allTypesExist')}
              </p>
            )}
          </div>

          {/* Expected count */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('addChecklistItem.expectedCount')}
            </label>
            <Input
              type="number"
              min={1}
              max={99}
              value={expectedCount}
              onChange={(e) => setExpectedCount(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('addChecklistItem.expectedCountHelp')}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              {t('addChecklistItem.reason')}
            </label>
            <textarea
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={2}
              placeholder={t('addChecklistItem.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {t('addChecklistItem.reasonHelp')}
            </p>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={!docType || isSubmitting || availableDocTypes.length === 0}
          >
            {isSubmitting ? t('addChecklistItem.adding') : t('common.add')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
