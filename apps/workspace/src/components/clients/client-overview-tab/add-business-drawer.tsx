/**
 * Add Business Drawer - Slide-over drawer for linking a new business to an individual client
 */
import { useState, useEffect } from 'react'
import { X, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { useMutation } from '@tanstack/react-query'
import { api, type LinkBusinessInput, type BusinessType } from '../../../lib/api-client'
import { BusinessInfoForm, type BusinessInfoData, EMPTY_BUSINESS_INFO } from '../business-info-form'

const currentYear = new Date().getFullYear() - 1
const TAX_YEARS = [currentYear, currentYear - 1, currentYear - 2]

interface AddBusinessDrawerProps {
  clientId: string
  clientPhone: string
  clientEmail?: string | null
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function AddBusinessDrawer({
  clientId,
  clientPhone,
  clientEmail,
  open,
  onClose,
  onSuccess,
}: AddBusinessDrawerProps) {
  const [business, setBusiness] = useState<BusinessInfoData>({ ...EMPTY_BUSINESS_INFO })
  const [taxYear, setTaxYear] = useState(TAX_YEARS[0])
  const [errors, setErrors] = useState<Partial<Record<keyof BusinessInfoData, string>>>({})

  // Handle escape key
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const mutation = useMutation({
    mutationFn: (data: LinkBusinessInput) => api.clients.linkBusiness(clientId, data),
    onSuccess: () => {
      onSuccess()
      onClose()
    },
  })

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof BusinessInfoData, string>> = {}
    if (!business.name.trim()) newErrors.name = 'Business name is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = () => {
    if (mutation.isPending) return
    if (!validate()) return

    const payload: LinkBusinessInput = {
      firstName: business.name,
      phone: clientPhone,
      email: clientEmail || undefined,
      businessType: business.businessType as BusinessType,
      ein: business.ein || undefined,
      businessAddress: business.address || undefined,
      businessCity: business.city || undefined,
      businessState: business.state || undefined,
      businessZip: business.zip || undefined,
      taxYear,
    }

    mutation.mutate(payload)
  }

  const handleOverlayClick = () => {
    if (!mutation.isPending) onClose()
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/50 transition-opacity duration-200',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 z-50 w-full max-w-md bg-card shadow-lg transition-transform duration-300 ease-out overflow-y-auto',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Add Business"
      >
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-foreground">Add Business</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Error */}
          {mutation.isError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {mutation.error instanceof Error ? mutation.error.message : 'Failed to create business'}
            </div>
          )}

          {/* Business Form */}
          <BusinessInfoForm
            data={business}
            onChange={(updates) => setBusiness((prev) => ({ ...prev, ...updates }))}
            errors={errors}
            idPrefix="add-biz-"
            hideTitle
          />

          {/* Tax Year */}
          <div className="mt-5 space-y-1.5">
            <label className="block text-sm font-medium text-foreground">Tax Year</label>
            <div className="flex gap-2">
              {TAX_YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setTaxYear(year)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    taxYear === year ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={mutation.isPending}
            className="w-full mt-6 px-4 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {mutation.isPending ? 'Creating...' : 'Create & Link Business'}
          </button>
        </div>
      </div>
    </>
  )
}
