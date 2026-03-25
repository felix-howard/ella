/**
 * Profile Form - Edit first name, last name, role, phone number
 * Uses react-phone-number-input for international phone formatting
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import PhoneInput, { isPossiblePhoneNumber } from 'react-phone-number-input'
import type { E164Number } from 'libphonenumber-js'
import { Loader2, Check, Edit2 } from 'lucide-react'
import { Button, Input, Switch } from '@ella/ui'
import { api, type StaffProfile } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { formatPhone } from '../../lib/formatters'
import { NotificationSubscriptions } from './notification-subscriptions'

// Phone input styles
import 'react-phone-number-input/style.css'

interface ProfileFormProps {
  staff: StaffProfile
  canEdit: boolean
  staffId: string
  canChangeRole: boolean
  onRoleChange?: (role: 'org:admin' | 'org:member') => void
  isRoleChangePending?: boolean
}

export function ProfileForm({ staff, canEdit, staffId, canChangeRole, onRoleChange, isRoleChangePending }: ProfileFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [isEditing, setIsEditing] = useState(false)

  // Form state - only used during edit mode
  const [editFirstName, setEditFirstName] = useState(staff.firstName)
  const [editLastName, setEditLastName] = useState(staff.lastName)
  const [editPhoneNumber, setEditPhoneNumber] = useState<E164Number | undefined>(
    staff.phoneNumber as E164Number | undefined
  )
  const [editNotifyOnUpload, setEditNotifyOnUpload] = useState(staff.notifyOnUpload)
  const [editRole, setEditRole] = useState<'org:admin' | 'org:member'>(
    staff.role === 'ADMIN' ? 'org:admin' : 'org:member'
  )

  // Validation errors
  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const updateMutation = useMutation({
    mutationFn: () =>
      api.team.updateProfile(staffId, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phoneNumber: editPhoneNumber || null,
        notifyOnUpload: editNotifyOnUpload,
      }),
    onSuccess: () => {
      // If role changed, trigger role update too
      const currentClerkRole = staff.role === 'ADMIN' ? 'org:admin' : 'org:member'
      if (editRole !== currentClerkRole && onRoleChange) {
        onRoleChange(editRole)
      }
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

    if (!editFirstName.trim()) {
      setFirstNameError(t('profile.firstNameRequired'))
      hasError = true
    } else {
      setFirstNameError(null)
    }

    if (!editLastName.trim()) {
      setLastNameError(t('profile.lastNameRequired'))
      hasError = true
    } else {
      setLastNameError(null)
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
    setEditFirstName(staff.firstName)
    setEditLastName(staff.lastName)
    setEditPhoneNumber(staff.phoneNumber as E164Number | undefined)
    setEditNotifyOnUpload(staff.notifyOnUpload)
    setEditRole(staff.role === 'ADMIN' ? 'org:admin' : 'org:member')
    setFirstNameError(null)
    setLastNameError(null)
    setPhoneError(null)
    setIsEditing(false)
  }

  const currentClerkRole = staff.role === 'ADMIN' ? 'org:admin' : 'org:member'
  const isDirty =
    editFirstName !== staff.firstName ||
    editLastName !== staff.lastName ||
    editPhoneNumber !== staff.phoneNumber ||
    editNotifyOnUpload !== staff.notifyOnUpload ||
    editRole !== currentClerkRole

  return (
    <div className="bg-card rounded-xl shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-muted/50 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">{t('profile.info')}</h2>
        {canEdit && !isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="w-4 h-4 mr-2" />
            {t('common.edit')}
          </Button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 p-6">
        {/* First Name + Last Name (side by side) */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-foreground mb-1.5">
              {t('profile.firstName')}
            </label>
            {isEditing ? (
              <>
                <Input
                  id="firstName"
                  value={editFirstName}
                  onChange={(e) => {
                    setEditFirstName(e.target.value)
                    if (firstNameError) setFirstNameError(null)
                  }}
                  required
                />
                {firstNameError && (
                  <p className="text-sm text-destructive mt-1">{firstNameError}</p>
                )}
              </>
            ) : (
              <p className="text-foreground">{staff.firstName}</p>
            )}
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-foreground mb-1.5">
              {t('profile.lastName')}
            </label>
            {isEditing ? (
              <>
                <Input
                  id="lastName"
                  value={editLastName}
                  onChange={(e) => {
                    setEditLastName(e.target.value)
                    if (lastNameError) setLastNameError(null)
                  }}
                  required
                />
                {lastNameError && (
                  <p className="text-sm text-destructive mt-1">{lastNameError}</p>
                )}
              </>
            ) : (
              <p className="text-foreground">{staff.lastName}</p>
            )}
          </div>
        </div>

        {/* Role */}
        <div>
          <label htmlFor="role" className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.role')}
          </label>
          {isEditing && canChangeRole ? (
            <select
              id="role"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as 'org:admin' | 'org:member')}
              disabled={isRoleChangePending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="org:admin">{t('team.admin')}</option>
              <option value="org:member">{t('team.member')}</option>
            </select>
          ) : (
            <p className="text-foreground">
              {staff.role === 'ADMIN' ? t('team.admin') : t('team.member')}
            </p>
          )}
        </div>

        {/* Email (read-only always) */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.email')}
          </label>
          {isEditing ? (
            <Input
              value={staff.email}
              readOnly
              className="cursor-not-allowed"
            />
          ) : (
            <p className="text-foreground">{staff.email}</p>
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
              {staff.phoneNumber ? formatPhone(staff.phoneNumber) : <span className="text-muted-foreground">{t('profile.notSet')}</span>}
            </p>
          )}
        </div>

        {/* Notification Preferences */}
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-sm font-medium text-foreground mb-4">
            {t('profile.notifications')}
          </h3>

          {/* Notify on Upload Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex-1 pr-4">
              <label htmlFor="notifyOnUpload" className="text-sm font-medium text-foreground">
                {t('profile.notifyOnUpload')}
              </label>
              <p className="text-sm text-muted-foreground">
                {t('profile.notifyOnUploadDesc')}
              </p>
            </div>
            <Switch
              id="notifyOnUpload"
              checked={isEditing ? editNotifyOnUpload : staff.notifyOnUpload}
              onCheckedChange={setEditNotifyOnUpload}
              disabled={!isEditing}
            />
          </div>

          {/* Phone required hint */}
          {!staff.phoneNumber && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('profile.phoneRequiredForSms')}
            </p>
          )}

          {/* Admin: subscribe to other members' client notifications */}
          {staff.role === 'ADMIN' && (
            <NotificationSubscriptions staffId={staffId} isEditing={isEditing} />
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
