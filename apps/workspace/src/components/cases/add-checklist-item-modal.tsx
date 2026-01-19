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
  Select,
} from '@ella/ui'
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
          {/* Doc type select */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Loại tài liệu <span className="text-error">*</span>
            </label>
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              required
            >
              <option value="">Chọn loại tài liệu</option>
              {availableDocTypes.map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
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
