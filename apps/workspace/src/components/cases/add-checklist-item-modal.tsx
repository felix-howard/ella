/**
 * AddChecklistItemModal - Staff modal to manually add checklist items
 * Allows staff to add documents not auto-generated from intake
 */

import { useState, useMemo } from 'react'
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
          <ModalTitle>Thêm mục vào checklist</ModalTitle>
          <ModalDescription>
            Thêm tài liệu cần thu thập từ khách hàng
          </ModalDescription>
        </ModalHeader>

        <ModalBody className="space-y-4">
          {/* Doc type select - custom dropdown */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Loại tài liệu <span className="text-error">*</span>
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
                  {docType ? DOC_TYPE_LABELS[docType] || docType : 'Chọn loại tài liệu'}
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
                Tất cả loại tài liệu đã có trong checklist
              </p>
            )}
          </div>

          {/* Expected count */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Số lượng cần thu
            </label>
            <Input
              type="number"
              min={1}
              max={99}
              value={expectedCount}
              onChange={(e) => setExpectedCount(parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Dùng cho tài liệu cần nhiều bản (VD: 12 bank statements)
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Lý do thêm
            </label>
            <textarea
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={2}
              placeholder="VD: Khách hàng có nhắc đến thu nhập freelance"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Ghi chú lý do để dễ theo dõi sau này
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
            Hủy
          </Button>
          <Button
            type="submit"
            disabled={!docType || isSubmitting || availableDocTypes.length === 0}
          >
            {isSubmitting ? 'Đang thêm...' : 'Thêm'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
