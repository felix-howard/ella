/**
 * CreateEngagementModal - Modal for creating new tax engagement
 * Allows selecting tax year and optionally copying from previous engagement
 */

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2 } from 'lucide-react'
import { cn, Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface CreateEngagementModalProps {
  clientId: string
  existingYears: number[]
  latestEngagementId?: string
  onClose: () => void
  onCreated: (engagementId: string) => void
}

// Available tax years
const TAX_YEARS = [2025, 2024, 2023]

export function CreateEngagementModal({
  clientId,
  existingYears,
  latestEngagementId,
  onClose,
  onCreated,
}: CreateEngagementModalProps) {
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [copyFromPrevious, setCopyFromPrevious] = useState(false)
  const queryClient = useQueryClient()

  // Filter out years that already have engagements
  const availableYears = TAX_YEARS.filter((y) => !existingYears.includes(y))

  const createMutation = useMutation({
    mutationFn: (data: { clientId: string; taxYear: number; copyFromEngagementId?: string }) =>
      api.engagements.create(data),
    onSuccess: (response) => {
      // Invalidate engagements and client queries
      queryClient.invalidateQueries({ queryKey: ['engagements', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      toast.success(`Đã tạo engagement năm ${selectedYear}`)
      onCreated(response.data.id)
    },
    onError: (error) => {
      console.error('Failed to create engagement:', error)
      toast.error('Không thể tạo engagement. Vui lòng thử lại.')
    },
  })

  const handleSubmit = () => {
    if (!selectedYear) return

    createMutation.mutate({
      clientId,
      taxYear: selectedYear,
      copyFromEngagementId: copyFromPrevious && latestEngagementId ? latestEngagementId : undefined,
    })
  }

  return (
    <Modal open onClose={onClose}>
      <ModalHeader>
        <ModalTitle>Thêm năm thuế mới</ModalTitle>
        <ModalDescription>
          Tạo engagement mới cho khách hàng này
        </ModalDescription>
      </ModalHeader>

      <div className="p-4 space-y-5">
        {/* Year selector */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Năm thuế <span className="text-destructive">*</span>
          </label>
          {availableYears.length > 0 ? (
            <div className="flex gap-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedYear === year
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              Khách hàng đã có engagement cho tất cả các năm ({TAX_YEARS.join(', ')}).
            </p>
          )}
        </div>

        {/* Copy from previous option - only show if there's a previous engagement and a year is selected */}
        {latestEngagementId && selectedYear && existingYears.length > 0 && (
          <div className="border-t border-border pt-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={copyFromPrevious}
                onChange={(e) => setCopyFromPrevious(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <span className="text-sm font-medium text-foreground flex items-center gap-2">
                  <Copy className="w-4 h-4" />
                  Sao chép thông tin từ năm trước
                </span>
                <p className="text-xs text-muted-foreground mt-1">
                  Tự động điền thông tin thu nhập, khấu trừ từ năm {existingYears[0]}
                </p>
              </div>
            </label>
          </div>
        )}

        {/* Info note */}
        {selectedYear && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground">
              Engagement mới sẽ được tạo cho năm thuế <strong>{selectedYear}</strong>.
              {copyFromPrevious && ' Thông tin sẽ được sao chép từ năm trước.'}
            </p>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button
          variant="outline"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Hủy
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!selectedYear || createMutation.isPending}
        >
          {createMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Đang tạo...
            </>
          ) : (
            'Tạo engagement'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
