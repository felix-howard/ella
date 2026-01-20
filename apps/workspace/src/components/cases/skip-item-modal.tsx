/**
 * SkipItemModal - Modal for entering skip reason when skipping checklist item
 * Replaces prompt() for better UX and accessibility
 */

import { useState } from 'react'
import {
  Modal,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalBody,
  ModalFooter,
  Button,
} from '@ella/ui'

interface SkipItemModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (reason: string) => void
  itemLabel?: string
  isSubmitting?: boolean
}

export function SkipItemModal({
  isOpen,
  onClose,
  onSubmit,
  itemLabel,
  isSubmitting = false,
}: SkipItemModalProps) {
  const [reason, setReason] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!reason.trim()) return
    onSubmit(reason.trim())
  }

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <Modal open={isOpen} onClose={handleClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle>Bỏ qua mục</ModalTitle>
          <ModalDescription>
            {itemLabel
              ? `Đánh dấu "${itemLabel}" là không cần thiết`
              : 'Đánh dấu mục này là không cần thiết'}
          </ModalDescription>
        </ModalHeader>

        <ModalBody>
          <div>
            <label
              htmlFor="skip-reason"
              className="block text-sm font-medium text-foreground mb-1.5"
            >
              Lý do bỏ qua <span className="text-error">*</span>
            </label>
            <textarea
              id="skip-reason"
              className="flex w-full rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              rows={3}
              placeholder="VD: Khách hàng không có loại thu nhập này"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              required
              autoFocus
              aria-describedby="skip-reason-hint"
            />
            <p id="skip-reason-hint" className="text-xs text-muted-foreground mt-1">
              Ghi lý do để dễ tra cứu sau này (tối đa 500 ký tự)
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
            variant="destructive"
            disabled={!reason.trim() || isSubmitting}
          >
            {isSubmitting ? 'Đang xử lý...' : 'Bỏ qua'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
