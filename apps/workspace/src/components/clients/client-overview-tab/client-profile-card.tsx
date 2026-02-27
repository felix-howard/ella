/**
 * Client Profile Card - Avatar, name, contact info with inline edit
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Phone, Mail, Pencil, Check, X, Loader2 } from 'lucide-react'
import { Button } from '@ella/ui'
import { api, type ClientDetail } from '../../../lib/api-client'
import { toast } from '../../../stores/toast-store'
import { formatPhone, formatPhoneInput } from '../../../lib/formatters'
import { ClientAvatarUploader } from './client-avatar-uploader'

interface ClientProfileCardProps {
  client: ClientDetail
}

export function ClientProfileCard({ client }: ClientProfileCardProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    firstName: client.firstName,
    lastName: client.lastName || '',
    phone: formatPhone(client.phone),
    email: client.email || '',
  })

  const updateMutation = useMutation({
    mutationFn: (data: { firstName?: string; lastName?: string | null; phone?: string; email?: string | null }) =>
      api.clients.update(client.id, data),
    onSuccess: () => {
      toast.success(t('clientOverview.profileUpdated'))
      queryClient.invalidateQueries({ queryKey: ['client', client.id] })
      setIsEditing(false)
    },
    onError: () => {
      toast.error(t('clientOverview.profileUpdateFailed'))
    },
  })

  const handleSave = () => {
    // Convert formatted phone (XXX) XXX-XXXX back to E.164 format +1XXXXXXXXXX
    const cleanedPhone = editData.phone.replace(/\D/g, '')
    const formattedPhone = cleanedPhone.length === 10 ? `+1${cleanedPhone}` : `+1${cleanedPhone.slice(-10)}`

    updateMutation.mutate({
      firstName: editData.firstName,
      lastName: editData.lastName || null,
      phone: formattedPhone,
      email: editData.email || null,
    })
  }

  const handleCancel = () => {
    setEditData({
      firstName: client.firstName,
      lastName: client.lastName || '',
      phone: formatPhone(client.phone),
      email: client.email || '',
    })
    setIsEditing(false)
  }

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex flex-col sm:flex-row gap-6">
        {/* Avatar */}
        <div className="flex-shrink-0 flex justify-center sm:justify-start">
          <ClientAvatarUploader
            clientId={client.id}
            currentAvatarUrl={client.avatarUrl ?? null}
            name={client.name}
            size="lg"
            canEdit={!isEditing}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <EditForm
              data={editData}
              onChange={setEditData}
              onSave={handleSave}
              onCancel={handleCancel}
              isSaving={updateMutation.isPending}
            />
          ) : (
            <DisplayInfo
              client={client}
              onEdit={() => setIsEditing(true)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function DisplayInfo({
  client,
  onEdit,
}: {
  client: ClientDetail
  onEdit: () => void
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold text-foreground truncate">{client.name}</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onEdit}
          className="flex-shrink-0"
        >
          <Pencil className="w-4 h-4 mr-1.5" />
          {t('clientOverview.editProfile')}
        </Button>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Phone className="w-4 h-4" />
          {formatPhone(client.phone)}
        </span>
        {client.email && (
          <span className="flex items-center gap-1.5">
            <Mail className="w-4 h-4" />
            {client.email}
          </span>
        )}
      </div>
    </div>
  )
}

function EditForm({
  data,
  onChange,
  onSave,
  onCancel,
  isSaving,
}: {
  data: { firstName: string; lastName: string; phone: string; email: string }
  onChange: (data: { firstName: string; lastName: string; phone: string; email: string }) => void
  onSave: () => void
  onCancel: () => void
  isSaving: boolean
}) {
  const { t } = useTranslation()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('clientOverview.firstName')}
          </label>
          <input
            type="text"
            value={data.firstName}
            onChange={(e) => onChange({ ...data, firstName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('clientOverview.lastName')}
          </label>
          <input
            type="text"
            value={data.lastName}
            onChange={(e) => onChange({ ...data, lastName: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('clientOverview.lastNameOptional')}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('clientOverview.phone')}
          </label>
          <input
            type="tel"
            value={data.phone}
            onChange={(e) => onChange({ ...data, phone: formatPhoneInput(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            disabled={isSaving}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('clientOverview.email')}
          </label>
          <input
            type="email"
            value={data.email}
            onChange={(e) => onChange({ ...data, email: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder={t('clientOverview.emailOptional')}
            disabled={isSaving}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={onSave} disabled={isSaving || !data.firstName || !data.phone} size="sm">
          {isSaving ? (
            <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
          ) : (
            <Check className="w-4 h-4 mr-1.5" />
          )}
          {t('clientOverview.saveProfile')}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isSaving} size="sm">
          <X className="w-4 h-4 mr-1.5" />
          {t('clientOverview.cancelEdit')}
        </Button>
      </div>
    </div>
  )
}
