/**
 * Add/Edit Contractor Modal
 * SSN is only submitted on create or when explicitly changed
 */
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { Modal, ModalHeader, ModalTitle, ModalFooter, Button, Input } from '@ella/ui'
import type { Contractor, CreateContractorInput, UpdateContractorInput } from '../../../../lib/api-client'

interface ContractorFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: CreateContractorInput | UpdateContractorInput) => void
  contractor: Contractor | null // null = create mode
  isSubmitting: boolean
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
  'DC',
]

export function ContractorFormModal({ isOpen, onClose, onSubmit, contractor, isSubmitting }: ContractorFormModalProps) {
  const isEdit = !!contractor

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ssn, setSsn] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')

  // Populate form when editing
  useEffect(() => {
    if (contractor) {
      setFirstName(contractor.firstName)
      setLastName(contractor.lastName)
      setSsn('') // Don't show encrypted SSN
      setAddress(contractor.address)
      setCity(contractor.city)
      setState(contractor.state)
      setZip(contractor.zip)
      setEmail(contractor.email || '')
      setPhone(contractor.phone || '')
    } else {
      setFirstName('')
      setLastName('')
      setSsn('')
      setAddress('')
      setCity('')
      setState('')
      setZip('')
      setEmail('')
      setPhone('')
    }
  }, [contractor, isOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (isEdit) {
      const data: UpdateContractorInput = {
        firstName,
        lastName,
        address,
        city,
        state,
        zip,
        email: email || null,
        phone: phone || null,
      }
      // Only include SSN if user entered a new one
      if (ssn.trim()) {
        data.ssn = ssn.replace(/\D/g, '')
      }
      onSubmit(data)
    } else {
      onSubmit({
        firstName,
        lastName,
        ssn: ssn.replace(/\D/g, ''),
        address,
        city,
        state,
        zip,
        email: email || undefined,
        phone: phone || undefined,
      })
    }
  }

  const isValid = firstName.trim() && lastName.trim() && address.trim() && city.trim() && state && zip.trim() && (isEdit || ssn.replace(/\D/g, '').length === 9)

  return (
    <Modal open={isOpen} onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle>{isEdit ? 'Edit Contractor' : 'Add Contractor'}</ModalTitle>
        </ModalHeader>

        <div className="px-6 pb-4 space-y-4">
          {/* Name row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">First Name *</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Last Name *</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
          </div>

          {/* SSN */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">
              SSN {isEdit ? '(leave blank to keep current)' : '*'}
            </label>
            <Input
              value={ssn}
              onChange={(e) => setSsn(e.target.value)}
              placeholder={isEdit ? `***-**-${contractor?.ssnLast4}` : '123-45-6789'}
              maxLength={11}
              required={!isEdit}
            />
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Address *</label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} required />
          </div>

          {/* City, State, ZIP */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">City *</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">State *</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="">Select</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">ZIP *</label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} placeholder="12345" maxLength={10} required />
            </div>
          </div>

          {/* Optional fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Phone</label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
        </div>

        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={!isValid || isSubmitting}>
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />}
            {isEdit ? 'Save Changes' : 'Add Contractor'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
