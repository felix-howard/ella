/**
 * Profile Form - Edit name and phone number
 * Uses react-phone-number-input for international phone formatting
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input'
import type { E164Number } from 'libphonenumber-js'
import { Loader2, Check, Edit2 } from 'lucide-react'
import { Button, Input } from '@ella/ui'
import { api, type StaffProfile } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'

// Phone input styles
import 'react-phone-number-input/style.css'

interface ProfileFormProps {
  staff: StaffProfile
  canEdit: boolean
  staffId: string
}

export function ProfileForm({ staff, canEdit, staffId }: ProfileFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  // Form state - only used during edit mode
  const [editName, setEditName] = useState(staff.name)
  const [editPhoneNumber, setEditPhoneNumber] = useState<E164Number | undefined>(
    staff.phoneNumber as E164Number | undefined
  )

  // Validation errors
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: () =>
      api.team.updateProfile(staffId, {
        name: editName.trim(),
        phoneNumber: editPhoneNumber || null,
      }),
    onSuccess: () => {
      toast.success(t('profile.updateSuccess'))
      queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
      queryClient.invalidateQueries({ queryKey: ['staff-me'] })
      setIsEditing(false)
    },
    onError: () => {
      toast.error(t('profile.updateError'))
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    let hasError = false

    if (!editName.trim()) {
      setNameError(t('profile.nameRequired'))
      hasError = true
    } else {
      setNameError(null)
    }

    if (editPhoneNumber && !isPossiblePhoneNumber(editPhoneNumber)) {
      setPhoneError(t('profile.phoneInvalid'))
      hasError = true
    } else {
      setPhoneError(null)
    }

    if (hasError) return

    updateMutation.mutate()
  }

  const handleCancel = () => {
    setEditName(staff.name)
    setEditPhoneNumber(staff.phoneNumber as E164Number | undefined)
    setNameError(null)
    setPhoneError(null)
    setIsEditing(false)
  }

  const isDirty = editName !== staff.name || editPhoneNumber !== staff.phoneNumber

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">{t('profile.info')}</h2>
        {canEdit && !isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            {t('common.edit')}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.name')}
          </label>
          {isEditing ? (
            <>
              <Input
                id="name"
                value={editName}
                onChange={(e) => {
                  setEditName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                required
              />
              {nameError && (
                <p className="text-sm text-destructive mt-1">{nameError}</p>
              )}
            </>
          ) : (
            <p className="text-foreground">{staff.name}</p>
          )}
        </div>

        {/* Email (read-only always) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.email')}
          </label>
          <p className="text-muted-foreground">{staff.email}</p>
          {isEditing && (
            <p className="text-xs text-muted-foreground mt-1">{t('profile.emailReadOnly')}</p>
          )}
        </div>

        {/* Phone */}
        <div>
          <label htmlFor="phoneNumber" className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.phone')}
          </label>
          {isEditing ? (
            <>
              <PhoneInput
                international
                defaultCountry="VN"
                value={editPhoneNumber}
                onChange={(value) => {
                  setEditPhoneNumber(value)
                  if (phoneError) setPhoneError(null)
                }}
                className="phone-input-wrapper"
              />
              {phoneError && (
                <p className="text-sm text-destructive mt-1">{phoneError}</p>
              )}
            </>
          ) : (
            <p className="text-foreground">
              {staff.phoneNumber || <span className="text-muted-foreground">{t('profile.notSet')}</span>}
            </p>
          )}
        </div>

        {/* Actions */}
        {isEditing && (
          <div className="flex items-center gap-3 pt-4">
            <Button type="submit" disabled={!isDirty || updateMutation.isPending}>
              {updateMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              {t('common.save')}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              {t('common.cancel')}
            </Button>
          </div>
        )}
      </form>
    </div>
  )
}
