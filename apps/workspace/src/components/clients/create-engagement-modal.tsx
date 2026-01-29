/**
 * CreateEngagementModal - Modal for creating new tax year engagement
 * Supports optional copy-from-previous-year feature
 */

import { useState, useMemo, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Calendar, Copy, Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalDescription, ModalFooter, Button, cn } from '@ella/ui'
import { api, type TaxEngagement } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

interface CreateEngagementModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  existingEngagements: TaxEngagement[]
  onSuccess: (newYear: number, engagementId: string) => void
}

// Available years to create engagements for (current year + next + previous 2)
const CURRENT_YEAR = new Date().getFullYear()
const AVAILABLE_YEARS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2]

export function CreateEngagementModal({
  isOpen,
  onClose,
  clientId,
  existingEngagements,
  onSuccess,
}: CreateEngagementModalProps) {
  const queryClient = useQueryClient()

  // Memoize available years to prevent re-computation on every render
  const availableYears = useMemo(() => {
    const existingYears = existingEngagements.map((e) => e.taxYear)
    return AVAILABLE_YEARS.filter((y) => !existingYears.includes(y))
  }, [existingEngagements])

  // Default to first available year
  const defaultYear = availableYears[0] ?? CURRENT_YEAR

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear)
  const [copyFromYear, setCopyFromYear] = useState<number | null>(null)

  // Reset state when modal closes and reopens (via key prop in parent or manual reset)
  const handleClose = useCallback(() => {
    setSelectedYear(defaultYear)
    setCopyFromYear(null)
    onClose()
  }, [onClose, defaultYear])

  // Find engagement to copy from
  const sourceEngagement = copyFromYear
    ? existingEngagements.find((e) => e.taxYear === copyFromYear)
    : null

  const createMutation = useMutation({
    mutationFn: () =>
      api.engagements.create({
        clientId,
        taxYear: selectedYear,
        copyFromEngagementId: sourceEngagement?.id,
      }),
    onSuccess: (response) => {
      toast.success(`Đã tạo engagement năm ${selectedYear}`)
      queryClient.invalidateQueries({ queryKey: ['engagements', clientId] })
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      onSuccess(selectedYear, response.data.id)
      onClose()
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Lỗi khi tạo engagement')
    },
  })

  const handleSubmit = () => {
    if (!selectedYear) return
    createMutation.mutate()
  }

  return (
    <Modal open={isOpen} onClose={handleClose} size="default">
      <ModalHeader>
        <ModalTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-primary" />
          Thêm năm thuế mới
        </ModalTitle>
        <ModalDescription>
          Tạo engagement mới cho khách hàng này
        </ModalDescription>
      </ModalHeader>

      <div className="py-4 space-y-6">
        {/* Year Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Chọn năm thuế
          </label>
          {availableYears.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Đã có engagement cho tất cả các năm khả dụng
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {availableYears.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setSelectedYear(year)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    selectedYear === year
                      ? 'bg-primary text-white'
                      : 'bg-muted hover:bg-muted/80 text-foreground'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Copy From Previous */}
        {existingEngagements.length > 0 && availableYears.length > 0 && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground flex items-center gap-2">
              <Copy className="w-4 h-4 text-muted-foreground" />
              Sao chép từ năm trước (không bắt buộc)
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setCopyFromYear(null)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-sm transition-colors',
                  copyFromYear === null
                    ? 'bg-primary text-white'
                    : 'bg-muted hover:bg-muted/80 text-foreground'
                )}
              >
                Không sao chép
              </button>
              {existingEngagements
                .sort((a, b) => b.taxYear - a.taxYear)
                .map((eng) => (
                  <button
                    key={eng.id}
                    type="button"
                    onClick={() => setCopyFromYear(eng.taxYear)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-sm transition-colors',
                      copyFromYear === eng.taxYear
                        ? 'bg-primary text-white'
                        : 'bg-muted hover:bg-muted/80 text-foreground'
                    )}
                  >
                    {eng.taxYear}
                  </button>
                ))}
            </div>
            {copyFromYear && (
              <p className="text-xs text-muted-foreground mt-1">
                Sẽ sao chép thông tin profile từ năm {copyFromYear}
              </p>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="outline" onClick={handleClose} disabled={createMutation.isPending}>
          Hủy
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={createMutation.isPending || availableYears.length === 0}
        >
          {createMutation.isPending && (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          )}
          Tạo engagement
        </Button>
      </ModalFooter>
    </Modal>
  )
}
