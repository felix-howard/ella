/**
 * QuickEditModal - Mini modal for quick inline editing of personal info fields
 * Supports name, phone, email with field-specific validation
 * Uses api.clients.update endpoint for saving changes
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type UpdateClientInput } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

// Supported editable fields for personal info
export type QuickEditField = 'firstName' | 'lastName' | 'phone' | 'email'

// Field configuration for labels and input types
const FIELD_CONFIG: Record<QuickEditField, { labelKey: string; type: string; placeholderKey: string }> = {
  firstName: {
    labelKey: 'clientField.firstName',
    type: 'text',
    placeholderKey: 'quickEdit.placeholder.firstName',
  },
  lastName: {
    labelKey: 'clientField.lastName',
    type: 'text',
    placeholderKey: 'quickEdit.placeholder.lastName',
  },
  phone: {
    labelKey: 'clientField.phone',
    type: 'tel',
    placeholderKey: 'quickEdit.placeholder.phone',
  },
  email: {
    labelKey: 'clientField.email',
    type: 'email',
    placeholderKey: 'quickEdit.placeholder.email',
  },
}

interface QuickEditModalProps {
  isOpen: boolean
  onClose: () => void
  field: QuickEditField
  currentValue: string
  clientId: string
}

/**
 * Wrapper component that only renders when open
 * This ensures fresh state on each open without needing useEffect setState
 */
export function QuickEditModal({ isOpen, ...props }: QuickEditModalProps) {
  if (!isOpen) return null
  return <QuickEditModalContent {...props} />
}

// Inner component with fresh state on each render
function QuickEditModalContent({
  onClose,
  field,
  currentValue,
  clientId,
}: Omit<QuickEditModalProps, 'isOpen'>) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [value, setValue] = useState(currentValue || '')
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const config = FIELD_CONFIG[field]
  const fieldLabel = t(config.labelKey)

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  // Mutation for saving
  const updateMutation = useMutation({
    mutationFn: (data: UpdateClientInput) => api.clients.update(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', clientId] })
      toast.success(t('quickEdit.updateSuccess', { field: fieldLabel }))
      onClose()
    },
    onError: (err) => {
      const errorMsg = err instanceof Error ? err.message : t('common.unknownError')
      setError(errorMsg)
    },
  })

  // Validation based on field type
  const validate = useCallback((): boolean => {
    const trimmedValue = value.trim()

    switch (field) {
      case 'firstName':
        if (trimmedValue.length < 1) {
          setError(t('quickEdit.firstNameRequired'))
          return false
        }
        if (trimmedValue.length > 50) {
          setError(t('quickEdit.firstNameTooLong'))
          return false
        }
        break

      case 'lastName':
        // lastName is optional, just validate length
        if (trimmedValue.length > 50) {
          setError(t('quickEdit.lastNameTooLong'))
          return false
        }
        break

      case 'phone':
        // E.164 format for US numbers only: +1 followed by 10 digits
        // Business requirement: System designed for US-based tax services
        if (!/^\+1\d{10}$/.test(trimmedValue)) {
          setError(t('quickEdit.phoneFormatError'))
          return false
        }
        break

      case 'email': {
        // Email is optional, but if provided must be valid
        // RFC 5322 compliant pattern (simplified for common cases)
        if (trimmedValue) {
          const emailPattern = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/
          if (!emailPattern.test(trimmedValue)) {
            setError(t('quickEdit.emailInvalid'))
            return false
          }
          if (trimmedValue.length > 254) {
            setError(t('quickEdit.emailTooLong'))
            return false
          }
        }
        break
      }
    }

    setError(null)
    return true
  }, [field, value, t])

  // Handle save
  const handleSave = useCallback(() => {
    if (!validate()) return

    const trimmedValue = value.trim()

    // Build update payload
    const updateData: UpdateClientInput = {}
    if (field === 'email') {
      // Email can be null (empty string -> null)
      updateData.email = trimmedValue || null
    } else if (field === 'lastName') {
      // lastName can be null (empty string -> null)
      updateData.lastName = trimmedValue || null
    } else if (field === 'firstName') {
      updateData.firstName = trimmedValue
    } else if (field === 'phone') {
      updateData.phone = trimmedValue
    }

    updateMutation.mutate(updateData)
  }, [field, value, validate, updateMutation])

  // Handle key events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !updateMutation.isPending) {
        e.preventDefault()
        handleSave()
      }
      if (e.key === 'Escape' && !updateMutation.isPending) {
        onClose()
      }
    },
    [handleSave, onClose, updateMutation.isPending]
  )

  // Handle global escape key
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !updateMutation.isPending) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [onClose, updateMutation.isPending])

  const hasChanges = value.trim() !== (currentValue || '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal - compact design */}
      <div
        className="relative bg-card rounded-xl shadow-xl w-full max-w-sm mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-edit-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="quick-edit-title" className="text-base font-semibold text-foreground">
            {t('quickEdit.title', { field: fieldLabel.toLowerCase() })}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={t('common.close')}
            disabled={updateMutation.isPending}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <label className="block text-sm text-muted-foreground mb-2">
            {fieldLabel}
          </label>
          <input
            ref={inputRef}
            type={config.type}
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(null)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t(config.placeholderKey)}
            disabled={updateMutation.isPending}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground
                       focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary
                       disabled:opacity-50 disabled:cursor-not-allowed"
            autoComplete={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'off'}
          />

          {/* Error display */}
          {error && (
            <p className="mt-2 text-sm text-red-500" role="alert">{error}</p>
          )}

          {/* Hint for phone format */}
          {field === 'phone' && !error && (
            <p className="mt-2 text-xs text-muted-foreground">
              {t('quickEdit.phoneFormatHint')}
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={updateMutation.isPending}
          >
            {t('common.cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                {t('common.saving')}
              </>
            ) : (
              t('common.save')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
