/**
 * Status Selector Component - Dropdown to change tax case status
 * Shows only valid transitions based on current status
 */

import { useState } from 'react'
import { ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { getValidNextStatuses } from '@ella/shared'
import { toast } from '../../stores/toast-store'
import { CASE_STATUS_LABELS, CASE_STATUS_COLORS } from '../../lib/constants'
import { api, type TaxCaseStatus } from '../../lib/api-client'

interface StatusSelectorProps {
  caseId: string
  currentStatus: TaxCaseStatus
  onStatusChange?: (newStatus: TaxCaseStatus) => void
  disabled?: boolean
}

export function StatusSelector({
  caseId,
  currentStatus,
  onStatusChange,
  disabled = false,
}: StatusSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // Get valid statuses (current + valid transitions) from shared package
  const validStatuses = getValidNextStatuses(currentStatus)

  const handleStatusChange = async (newStatus: TaxCaseStatus) => {
    if (newStatus === currentStatus) {
      setIsOpen(false)
      return
    }

    setIsUpdating(true)
    setIsOpen(false)

    try {
      await api.cases.update(caseId, { status: newStatus })
      toast.success(`Đã cập nhật trạng thái: ${CASE_STATUS_LABELS[newStatus]}`)
      onStatusChange?.(newStatus)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật trạng thái'
      toast.error(message)
    } finally {
      setIsUpdating(false)
    }
  }

  const colors = CASE_STATUS_COLORS[currentStatus]

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => !disabled && !isUpdating && setIsOpen(!isOpen)}
        disabled={disabled || isUpdating}
        className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
          'border focus:outline-none focus:ring-2 focus:ring-primary/20',
          colors?.bg || 'bg-muted',
          colors?.text || 'text-muted-foreground',
          colors?.border || 'border-border',
          disabled || isUpdating ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {isUpdating ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          <span>{CASE_STATUS_LABELS[currentStatus]}</span>
        )}
        <ChevronDown
          className={cn('w-4 h-4 transition-transform', isOpen && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
          />

          {/* Dropdown options */}
          <div
            className="absolute top-full left-0 mt-1 z-20 min-w-[200px] bg-card rounded-lg border border-border shadow-lg py-1"
            role="listbox"
          >
            {validStatuses.map((status) => {
              const statusColors = CASE_STATUS_COLORS[status]
              const isSelected = status === currentStatus

              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleStatusChange(status)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors',
                    isSelected
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-foreground hover:bg-muted'
                  )}
                  role="option"
                  aria-selected={isSelected}
                >
                  <span
                    className={cn(
                      'w-2 h-2 rounded-full',
                      statusColors?.bg || 'bg-muted'
                    )}
                    aria-hidden="true"
                  />
                  <span>{CASE_STATUS_LABELS[status]}</span>
                  {isSelected && (
                    <span className="ml-auto text-xs text-muted-foreground">(Hiện tại)</span>
                  )}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
