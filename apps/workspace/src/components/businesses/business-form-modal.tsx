/**
 * Modal for creating/editing a business entity
 * Fields: name, type, EIN, address, city, state, zip
 */
import { useState, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalFooter, Button, Input } from '@ella/ui'
import { api, type Business, type BusinessType, type CreateBusinessInput } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

const BUSINESS_TYPES: { value: BusinessType; label: string }[] = [
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
  { value: 'LLC', label: 'LLC' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'S_CORP', label: 'S-Corp' },
  { value: 'C_CORP', label: 'C-Corp' },
]

interface BusinessFormModalProps {
  isOpen: boolean
  onClose: () => void
  clientId: string
  business?: Business | null
}

export function BusinessFormModal({ isOpen, onClose, clientId, business }: BusinessFormModalProps) {
  const queryClient = useQueryClient()
  const isEdit = !!business

  const [form, setForm] = useState({
    name: '',
    type: 'LLC' as BusinessType,
    ein: '',
    address: '',
    city: '',
    state: '',
    zip: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen) {
      if (business) {
        setForm({
          name: business.name,
          type: business.type,
          ein: '', // EIN is masked, user must re-enter to change
          address: business.address,
          city: business.city,
          state: business.state,
          zip: business.zip,
        })
      } else {
        setForm({ name: '', type: 'LLC', ein: '', address: '', city: '', state: '', zip: '' })
      }
      setErrors({})
    }
  }, [isOpen, business])

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!form.name.trim()) newErrors.name = 'Business name is required'
    if (!isEdit && !form.ein) newErrors.ein = 'EIN is required'
    if (form.ein && !/^\d{2}-\d{7}$/.test(form.ein)) newErrors.ein = 'EIN must be XX-XXXXXXX format'
    if (!form.address.trim()) newErrors.address = 'Address is required'
    if (!form.city.trim()) newErrors.city = 'City is required'
    if (!form.state.trim() || form.state.length !== 2) newErrors.state = 'State must be 2-letter code'
    if (!form.zip.trim() || !/^\d{5}(-\d{4})?$/.test(form.zip)) newErrors.zip = 'ZIP must be 5 or 9 digits'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Auto-format EIN as XX-XXXXXXX
  const handleEinChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 9)
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits
    setForm((prev) => ({ ...prev, ein: formatted }))
  }

  const createMutation = useMutation({
    mutationFn: (data: CreateBusinessInput) => api.businesses.create(clientId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', clientId] })
      toast.success('Business created')
      onClose()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create business')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) =>
      api.businesses.update(clientId, business!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['businesses', clientId] })
      toast.success('Business updated')
      onClose()
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to update business')
    },
  })

  const handleSubmit = () => {
    if (!validate()) return

    if (isEdit) {
      const updates: Record<string, string> = {}
      if (form.name !== business!.name) updates.name = form.name.trim()
      if (form.type !== business!.type) updates.type = form.type
      if (form.ein) updates.ein = form.ein
      if (form.address !== business!.address) updates.address = form.address.trim()
      if (form.city !== business!.city) updates.city = form.city.trim()
      if (form.state !== business!.state) updates.state = form.state.toUpperCase()
      if (form.zip !== business!.zip) updates.zip = form.zip.trim()
      if (Object.keys(updates).length === 0) { onClose(); return }
      updateMutation.mutate(updates)
    } else {
      createMutation.mutate({
        name: form.name.trim(),
        type: form.type,
        ein: form.ein,
        address: form.address.trim(),
        city: form.city.trim(),
        state: form.state.toUpperCase(),
        zip: form.zip.trim(),
      })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  return (
    <Modal open={isOpen} onClose={onClose}>
      <ModalHeader>
        <ModalTitle>{isEdit ? 'Edit Business' : 'Add Business'}</ModalTitle>
      </ModalHeader>

      <div className="px-6 pb-4 space-y-4">
        {/* Business Name */}
        <div className="space-y-1">
          <label htmlFor="biz-name" className="text-sm font-medium text-foreground">
            Business Name <span className="text-destructive">*</span>
          </label>
          <Input
            id="biz-name"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Acme Corp"
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        {/* Business Type */}
        <div className="space-y-1">
          <label htmlFor="biz-type" className="text-sm font-medium text-foreground">Business Type</label>
          <select
            id="biz-type"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as BusinessType }))}
            className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            {BUSINESS_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>
        </div>

        {/* EIN */}
        <div className="space-y-1">
          <label htmlFor="biz-ein" className="text-sm font-medium text-foreground">
            EIN {!isEdit && <span className="text-destructive">*</span>}
          </label>
          <Input
            id="biz-ein"
            value={form.ein}
            onChange={(e) => handleEinChange(e.target.value)}
            placeholder={isEdit ? business!.einMasked : 'XX-XXXXXXX'}
            maxLength={10}
          />
          {isEdit && (
            <p className="text-xs text-muted-foreground">Leave blank to keep current EIN</p>
          )}
          {errors.ein && <p className="text-xs text-destructive">{errors.ein}</p>}
        </div>

        {/* Address */}
        <div className="space-y-1">
          <label htmlFor="biz-address" className="text-sm font-medium text-foreground">
            Address <span className="text-destructive">*</span>
          </label>
          <Input
            id="biz-address"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
            placeholder="123 Main St"
          />
          {errors.address && <p className="text-xs text-destructive">{errors.address}</p>}
        </div>

        {/* City, State, ZIP */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label htmlFor="biz-city" className="text-sm font-medium text-foreground">
              City <span className="text-destructive">*</span>
            </label>
            <Input
              id="biz-city"
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
              placeholder="City"
            />
            {errors.city && <p className="text-xs text-destructive">{errors.city}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="biz-state" className="text-sm font-medium text-foreground">
              State <span className="text-destructive">*</span>
            </label>
            <Input
              id="biz-state"
              value={form.state}
              onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase().slice(0, 2) }))}
              placeholder="CA"
              maxLength={2}
            />
            {errors.state && <p className="text-xs text-destructive">{errors.state}</p>}
          </div>
          <div className="space-y-1">
            <label htmlFor="biz-zip" className="text-sm font-medium text-foreground">
              ZIP <span className="text-destructive">*</span>
            </label>
            <Input
              id="biz-zip"
              value={form.zip}
              onChange={(e) => setForm((prev) => ({ ...prev, zip: e.target.value }))}
              placeholder="12345"
              maxLength={10}
            />
            {errors.zip && <p className="text-xs text-destructive">{errors.zip}</p>}
          </div>
        </div>
      </div>

      <ModalFooter>
        <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
          {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Add Business'}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
