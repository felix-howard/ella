/**
 * Firm Info Card (org-admin only)
 * Lets org admins set the firm's mailing address and governing law
 * used to auto-fill NDA headers.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Building2, Edit2, Check } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { api } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'
import { useInvalidateNdaReadiness } from '../agreements/use-nda-readiness'

// Minimal US state list (2-letter codes)
const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA',
  'HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const QUERY_KEY = ['org-settings']

export function FirmInfoCard() {
  const { isAdmin } = useOrgRole()

  const queryClient = useQueryClient()
  const invalidateReadiness = useInvalidateNdaReadiness()
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.orgSettings.get(),
  })

  const [form, setForm] = useState({
    address: '',
    city: '',
    state: '',
    zip: '',
    governingState: '',
    governingCounty: '',
    firmPhone: '',
    firmEmail: '',
    firmWebsite: '',
  })

  // Sync form from query data when entering edit mode
  const startEditing = () => {
    setForm({
      address: data?.address ?? '',
      city: data?.city ?? '',
      state: data?.state ?? '',
      zip: data?.zip ?? '',
      governingState: data?.governingState ?? '',
      governingCounty: data?.governingCounty ?? '',
      firmPhone: data?.firmPhone ?? '',
      firmEmail: data?.firmEmail ?? '',
      firmWebsite: data?.firmWebsite ?? '',
    })
    setIsEditing(true)
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.orgSettings.update({
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state || null,
        zip: form.zip.trim() || null,
        governingState: form.governingState.trim() || null,
        governingCounty: form.governingCounty.trim() || null,
        firmPhone: form.firmPhone.trim() || null,
        firmEmail: form.firmEmail.trim() || null,
        firmWebsite: form.firmWebsite.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated)
      invalidateReadiness()
      toast.success('Firm info updated')
      setIsEditing(false)
    },
    onError: () => {
      toast.error('Failed to update firm info')
    },
  })

  // Hidden for non-admins
  if (!isAdmin) return null

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  return (
    <div data-settings-focus="firm-info" className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Firm Information</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Used to auto-fill agreement headers. Visible to org admins only.
            </p>
          </div>
        </div>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={startEditing} disabled={isLoading}>
            <Edit2 className="w-4 h-4 mr-2" />
            Edit
          </Button>
        )}
      </div>

      <div className="p-6 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-16">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : isEditing ? (
          <>
            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Street Address</label>
              <Input value={form.address} onChange={set('address')} maxLength={200} placeholder="10700 Richmond Ave Ste 117" />
            </div>

            {/* City + State + Zip */}
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-foreground mb-1.5">City</label>
                <Input value={form.city} onChange={set('city')} maxLength={100} placeholder="Houston" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">State</label>
                <select
                  value={form.state}
                  onChange={set('state')}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="">—</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">ZIP</label>
                <Input value={form.zip} onChange={set('zip')} maxLength={20} placeholder="77042" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Phone</label>
                <Input value={form.firmPhone} onChange={set('firmPhone')} maxLength={30} placeholder="+1 555 123 4567" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Email</label>
                <Input type="email" value={form.firmEmail} onChange={set('firmEmail')} maxLength={254} placeholder="office@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Website</label>
                <Input value={form.firmWebsite} onChange={set('firmWebsite')} maxLength={200} placeholder="https://example.com" />
              </div>
            </div>

            {/* Governing law */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Governing State</label>
                <Input value={form.governingState} onChange={set('governingState')} maxLength={50} placeholder="Texas" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Governing County</label>
                <Input value={form.governingCounty} onChange={set('governingCounty')} maxLength={100} placeholder="Harris County" />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Save
              </Button>
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={mutation.isPending}>
                Cancel
              </Button>
            </div>
          </>
        ) : (
          /* Read-only view */
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-muted-foreground">Address</dt>
              <dd className="text-foreground mt-0.5">
                {data?.address ? (
                  <>{data.address}<br />{data.city}, {data.state} {data.zip}</>
                ) : <span className="text-muted-foreground">Not set</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Governing Law</dt>
              <dd className="text-foreground mt-0.5">
                {data?.governingState ? (
                  <>{data.governingState}{data.governingCounty ? `, ${data.governingCounty}` : ''}</>
                ) : <span className="text-muted-foreground">Not set</span>}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Contact</dt>
              <dd className="text-foreground mt-0.5">
                {data?.firmPhone || data?.firmEmail || data?.firmWebsite ? (
                  <>
                    {data.firmPhone && <>{data.firmPhone}<br /></>}
                    {data.firmEmail && <>{data.firmEmail}<br /></>}
                    {data.firmWebsite}
                  </>
                ) : <span className="text-muted-foreground">Not set</span>}
              </dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
