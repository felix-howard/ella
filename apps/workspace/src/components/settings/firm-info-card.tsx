/**
 * Firm Info Card
 * Lets org admins set the firm's mailing address and governing law
 * used to auto-fill NDA headers.
 */
import { useState } from 'react'
import { useOrganization } from '@clerk/clerk-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Building2, Edit2, Check, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Input } from '@ella/ui'
import { api, type OrgSettings } from '../../lib/api-client'
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
const EMPTY_FORM = {
  name: '',
  address: '',
  city: '',
  state: '',
  zip: '',
  governingState: '',
  governingCounty: '',
  firmEmail: '',
  firmWebsite: '',
}

function createFirmInfoForm(
  settings?: Pick<
    OrgSettings,
    | 'name'
    | 'address'
    | 'city'
    | 'state'
    | 'zip'
    | 'governingState'
    | 'governingCounty'
    | 'firmEmail'
    | 'firmWebsite'
  > | null
) {
  return {
    name: settings?.name ?? '',
    address: settings?.address ?? '',
    city: settings?.city ?? '',
    state: settings?.state ?? '',
    zip: settings?.zip ?? '',
    governingState: settings?.governingState ?? '',
    governingCounty: settings?.governingCounty ?? '',
    firmEmail: settings?.firmEmail ?? '',
    firmWebsite: settings?.firmWebsite ?? '',
  }
}

export function FirmInfoCard() {
  const { t } = useTranslation()
  const { canManageOrganizationSettings } = useOrgRole()
  const { organization } = useOrganization()
  const isReadOnly = !canManageOrganizationSettings

  const queryClient = useQueryClient()
  const invalidateReadiness = useInvalidateNdaReadiness()
  const [isEditing, setIsEditing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.orgSettings.get(),
  })

  const [form, setForm] = useState(EMPTY_FORM)

  // Sync form from query data when entering edit mode
  const startEditing = () => {
    if (isReadOnly) return
    setForm(createFirmInfoForm(data))
    setIsEditing(true)
  }

  const mutation = useMutation({
    mutationFn: () =>
      api.orgSettings.update({
        name: form.name.trim(),
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state || null,
        zip: form.zip.trim() || null,
        governingState: form.governingState.trim() || null,
        governingCounty: form.governingCounty.trim() || null,
        firmEmail: form.firmEmail.trim() || null,
        firmWebsite: form.firmWebsite.trim() || null,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEY, updated)
      organization?.reload().catch(() => undefined)
      invalidateReadiness()
      toast.success(t('settings.firmInfoUpdated'))
      setIsEditing(false)
    },
    onError: () => {
      toast.error(t('settings.firmInfoUpdateFailed'))
    },
  })

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const save = () => {
    if (isReadOnly) return
    if (!form.name.trim()) {
      toast.error(t('settings.organizationNameRequired'))
      return
    }
    mutation.mutate()
  }

  const twilioInboundNumber = data?.twilioInboundNumber ?? data?.firmPhone ?? ''

  return (
    <div data-settings-focus="firm-info" className="bg-card rounded-xl shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-3">
          <Building2 className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold text-foreground">Firm Information</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {!isReadOnly
                ? t('settings.firmInfoDescription')
                : t('settings.firmInfoAdminOnlyDescription')}
            </p>
          </div>
        </div>
        {isReadOnly && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            <Lock className="h-3 w-3" />
            {t('settings.adminOnly')}
          </span>
        )}
        {!isReadOnly && !isEditing && (
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
              <label className="block text-sm font-medium text-foreground mb-1.5">Organization Name</label>
              <Input value={form.name} onChange={set('name')} maxLength={100} placeholder="Ella Team" />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Street Address</label>
              <Input value={form.address} onChange={set('address')} maxLength={200} placeholder="10700 Richmond Ave Ste 117" />
            </div>

            {/* City + State + Zip */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Twilio Inbound Number</label>
                <Input
                  value={twilioInboundNumber}
                  readOnly
                  maxLength={30}
                  placeholder="+1 555 123 4567"
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              <Button onClick={save} disabled={mutation.isPending || !form.name.trim()}>
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
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Organization Name</dt>
              <dd className="text-foreground mt-0.5">
                {data?.name || <span className="text-muted-foreground">Not set</span>}
              </dd>
            </div>
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
                {twilioInboundNumber || data?.firmEmail || data?.firmWebsite ? (
                  <>
                    {twilioInboundNumber && <>{twilioInboundNumber}<br /></>}
                    {data?.firmEmail && <>{data.firmEmail}<br /></>}
                    {data?.firmWebsite}
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
