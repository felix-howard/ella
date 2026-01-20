/**
 * SectionEditModal - Modal for editing intake form section data
 * Reuses IntakeQuestion component for field rendering
 * Supports all field types: BOOLEAN, NUMBER, CURRENCY, NUMBER_INPUT, SELECT, TEXT
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type ClientDetail, type UpdateProfileInput } from '../../lib/api-client'
import { SECTION_CONFIG, FIELD_CONFIG, formatToFieldType } from '../../lib/intake-form-config'
import { toast } from '../../stores/toast-store'
import { IntakeQuestion } from './intake-question'

interface SectionEditModalProps {
  isOpen: boolean
  onClose: () => void
  sectionKey: string
  client: ClientDetail
}

export function SectionEditModal({ isOpen, onClose, sectionKey, client }: SectionEditModalProps) {
  const queryClient = useQueryClient()
  const [localAnswers, setLocalAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [isDirty, setIsDirty] = useState(false)

  // Get section fields from FIELD_CONFIG
  const sectionFields = useMemo(() => {
    return Object.entries(FIELD_CONFIG)
      .filter(([_, config]) => config.section === sectionKey)
      .map(([key, config]) => ({ key, ...config }))
  }, [sectionKey])

  // Initialize local answers from current values
  useEffect(() => {
    if (isOpen && client.profile) {
      const intakeAnswers = client.profile.intakeAnswers || {}
      const initialValues: Record<string, unknown> = {}

      sectionFields.forEach(({ key }) => {
        if (intakeAnswers[key] !== undefined) {
          initialValues[key] = intakeAnswers[key]
        }
      })

      setLocalAnswers(initialValues)
      setError(null)
      setIsDirty(false)
    }
  }, [isOpen, client.profile, sectionFields])

  // Mutation for saving
  const updateMutation = useMutation({
    mutationFn: (data: UpdateProfileInput) => api.clients.updateProfile(client.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      toast.success('Cập nhật thành công')
      onClose()
    },
    onError: (err) => {
      const errorMsg = err instanceof Error ? err.message : 'Lỗi không xác định'
      setError(errorMsg)
      toast.error('Lỗi cập nhật: ' + errorMsg)
    }
  })

  // Handle field change with useCallback for stability
  const handleChange = useCallback((key: string, value: unknown) => {
    setLocalAnswers(prev => ({ ...prev, [key]: value }))
    setError(null)
    setIsDirty(true)
  }, [])

  // Save handler with validation
  const handleSave = useCallback(() => {
    // Filter out undefined values and prepare data
    const filteredAnswers: Record<string, boolean | number | string> = {}
    Object.entries(localAnswers).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        filteredAnswers[key] = value as boolean | number | string
      }
    })

    updateMutation.mutate({ intakeAnswers: filteredAnswers })
  }, [localAnswers, updateMutation])

  // Handle close with dirty check
  const handleClose = useCallback(() => {
    if (isDirty && !updateMutation.isPending) {
      // Could add confirmation dialog here in future
      // For now, just close
    }
    onClose()
  }, [isDirty, updateMutation.isPending, onClose])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !updateMutation.isPending) {
        handleClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleClose, updateMutation.isPending])

  if (!isOpen) return null

  const sectionTitle = SECTION_CONFIG[sectionKey]?.title || sectionKey

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="relative bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="modal-title" className="text-lg font-semibold text-foreground">
            Chỉnh sửa: {sectionTitle}
          </h2>
          <button
            onClick={handleClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label="Đóng"
            disabled={updateMutation.isPending}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body - scrollable */}
        <div className="p-4 space-y-3 overflow-y-auto max-h-[calc(90vh-140px)]">
          {sectionFields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Không có trường nào trong section này
            </p>
          ) : (
            sectionFields.map(({ key, label, format, options }) => (
              <IntakeQuestion
                key={key}
                questionKey={key}
                label={label}
                fieldType={formatToFieldType(format)}
                options={options}
                value={localAnswers[key]}
                onChange={handleChange}
                answers={localAnswers}
              />
            ))
          )}

          {/* Error display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={updateMutation.isPending}
          >
            Hủy
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={updateMutation.isPending || !isDirty}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Đang lưu...
              </>
            ) : (
              'Lưu thay đổi'
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
