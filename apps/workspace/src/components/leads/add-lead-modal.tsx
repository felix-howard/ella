/**
 * AddLeadModal - Create a new lead with basic contact info
 * Fields: firstName, lastName, phone, email (optional)
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { api } from '../../lib/api-client'
import { formatPhoneInput } from '../../lib/formatters'
import { toast } from '../../stores/toast-store'

interface AddLeadModalProps {
  isOpen: boolean
  onClose: () => void
}

interface FormData {
  firstName: string
  lastName: string
  phone: string
  email: string
}

interface FormErrors {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  submit?: string
}

const EMPTY_FORM: FormData = { firstName: '', lastName: '', phone: '', email: '' }

/** Format US phone digits to +1XXXXXXXXXX */
const toE164Phone = (phone: string) => `+1${phone.replace(/\D/g, '').slice(0, 10)}`

export function AddLeadModal({ isOpen, onClose }: AddLeadModalProps) {
  if (!isOpen) return null
  return <AddLeadModalContent onClose={onClose} />
}

function AddLeadModalContent({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [errors, setErrors] = useState<FormErrors>({})
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => firstInputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const createMutation = useMutation({
    mutationFn: () =>
      api.leads.create({
        firstName: form.firstName.trim().slice(0, 100),
        lastName: form.lastName.trim().slice(0, 100),
        phone: toE164Phone(form.phone),
        email: form.email.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success(t('leads.createSuccess', 'Lead created successfully'))
      onClose()
    },
    onError: (err) => {
      const message = err instanceof Error ? err.message : t('leads.createError', 'Failed to create lead')
      setErrors((prev) => ({ ...prev, submit: message }))
    },
  })

  const validate = useCallback((): boolean => {
    const next: FormErrors = {}
    if (!form.firstName.trim()) next.firstName = t('newClient.errorFirstNameRequired', 'First name is required')
    if (!form.lastName.trim()) next.lastName = t('newClient.errorLastNameRequired', 'Last name is required')

    const cleanedPhone = form.phone.replace(/\D/g, '')
    if (!cleanedPhone) next.phone = t('newClient.errorPhoneRequired', 'Phone is required')
    else if (cleanedPhone.length !== 10) next.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')

    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = t('newClient.errorEmailInvalid', 'Invalid email')
    }

    setErrors(next)
    return Object.keys(next).length === 0
  }, [form, t])

  const handleSubmit = useCallback(() => {
    if (createMutation.isPending) return
    if (!validate()) return
    createMutation.mutate()
  }, [createMutation, validate])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !createMutation.isPending) {
        e.preventDefault()
        handleSubmit()
      }
    },
    [handleSubmit, createMutation.isPending],
  )

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !createMutation.isPending) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [onClose, createMutation.isPending])

  const updateField = (key: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined, submit: undefined }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={createMutation.isPending ? undefined : onClose}
        aria-hidden="true"
      />

      <div
        className="relative bg-card rounded-xl shadow-xl w-full max-w-md mx-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-lead-title"
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 id="add-lead-title" className="text-base font-semibold text-foreground">
            {t('leads.addLead', 'Add Lead')}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted transition-colors"
            aria-label={t('common.close', 'Close')}
            disabled={createMutation.isPending}
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-4 space-y-3" onKeyDown={handleKeyDown}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {t('leads.firstName', 'First Name')} <span className="text-error">*</span>
              </label>
              <input
                ref={firstInputRef}
                type="text"
                value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)}
                disabled={createMutation.isPending}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50"
                maxLength={100}
              />
              {errors.firstName && <p className="mt-1 text-xs text-error">{errors.firstName}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">
                {t('leads.lastName', 'Last Name')} <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)}
                disabled={createMutation.isPending}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50"
                maxLength={100}
              />
              {errors.lastName && <p className="mt-1 text-xs text-error">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t('leads.phone', 'Phone')} <span className="text-error">*</span>
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => updateField('phone', formatPhoneInput(e.target.value))}
              placeholder="(555) 123-4567"
              disabled={createMutation.isPending}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50"
              autoComplete="tel"
              maxLength={14}
            />
            {errors.phone && <p className="mt-1 text-xs text-error">{errors.phone}</p>}
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              {t('leads.email', 'Email')}
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder={t('leads.emailPlaceholder', 'email@example.com')}
              disabled={createMutation.isPending}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary disabled:opacity-50"
              autoComplete="email"
              maxLength={254}
            />
            {errors.email && <p className="mt-1 text-xs text-error">{errors.email}</p>}
          </div>

          {errors.submit && (
            <div className="p-2 bg-error-light rounded-lg text-sm text-error" role="alert">
              {errors.submit}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={createMutation.isPending}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                {t('common.saving', 'Saving...')}
              </>
            ) : (
              t('leads.addLead', 'Add Lead')
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
