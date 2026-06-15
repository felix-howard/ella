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
import { api, type AppRole, type StaffProfile } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { formatPhone } from '../../lib/formatters'
import { NotificationSubscriptions } from './notification-subscriptions'
import { TermsDownloadButton } from './terms-download-button'
import { ContractorAgreementDownloadButton } from './contractor-agreement-download-button'
import { useInvalidateNdaReadiness } from '../agreements/use-nda-readiness'

// Phone input styles
import 'react-phone-number-input/style.css'

/**
 * Map DB Staff.role to the app-level role used by team endpoints.
 * CPA maps to MEMBER for the selector — an unchanged select stays non-dirty,
 * so a CPA's role is never accidentally rewritten to STAFF.
 */
function staffRoleToAppRole(role: string): AppRole {
  if (role === 'ADMIN') return 'ADMIN'
  if (role === 'MANAGER') return 'MANAGER'
  return 'MEMBER'
}

interface ProfileFormProps {
  staff: StaffProfile
  canEdit: boolean
  staffId: string
  canChangeRole: boolean
  onRoleChange?: (role: AppRole) => Promise<void>
  isRoleChangePending?: boolean
  canManageContractorAgent?: boolean
  canViewContractorAgreement?: boolean
  hideNotifications?: boolean
  isOwnProfile?: boolean
}

export function ProfileForm({
  staff,
  canEdit,
  staffId,
  canChangeRole,
  onRoleChange,
  isRoleChangePending,
  canManageContractorAgent = false,
  canViewContractorAgreement = false,
  hideNotifications,
  isOwnProfile = false,
}: ProfileFormProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const invalidateReadiness = useInvalidateNdaReadiness()
  const [isEditing, setIsEditing] = useState(false)

  // Form state - only used during edit mode
  const [editFirstName, setEditFirstName] = useState(staff.firstName)
  const [editLastName, setEditLastName] = useState(staff.lastName)
  const [editTitle, setEditTitle] = useState(staff.title ?? '')
  const [editPhoneNumber, setEditPhoneNumber] = useState<E164Number | undefined>(
    staff.phoneNumber as E164Number | undefined
  )
  const [editNotifyOnUpload, setEditNotifyOnUpload] = useState(staff.notifyOnUpload)
  const [editRole, setEditRole] = useState<AppRole>(staffRoleToAppRole(staff.role))
  const [editIsContractorAgent, setEditIsContractorAgent] = useState(staff.isContractorAgent)

  // Validation errors
  const [firstNameError, setFirstNameError] = useState<string | null>(null)
  const [lastNameError, setLastNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)

  const currentAppRole = staffRoleToAppRole(staff.role)
  const isProfileDirty =
    editFirstName !== staff.firstName ||
    editLastName !== staff.lastName ||
    editTitle !== (staff.title ?? '') ||
    editPhoneNumber !== staff.phoneNumber ||
    editNotifyOnUpload !== staff.notifyOnUpload
  const isRoleDirty = editRole !== currentAppRole
  const isContractorAgentDirty =
    canManageContractorAgent && editIsContractorAgent !== staff.isContractorAgent

  const invalidateStaffProfileCaches = () => {
    queryClient.invalidateQueries({ queryKey: ['team-member-profile', staffId] })
    queryClient.invalidateQueries({ queryKey: ['team-members'] })
    queryClient.invalidateQueries({ queryKey: ['assignable-staff'] })
    queryClient.invalidateQueries({ queryKey: ['staff-me'] })
  }

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (isProfileDirty) {
        await api.team.updateProfile(staffId, {
          firstName: editFirstName.trim(),
          lastName: editLastName.trim(),
          phoneNumber: editPhoneNumber || null,
          title: editTitle.trim() || null,
          notifyOnUpload: editNotifyOnUpload,
        })
        invalidateStaffProfileCaches()
      }

      if (isContractorAgentDirty) {
        await api.team.updateContractorAgent(staffId, editIsContractorAgent)
        invalidateStaffProfileCaches()
      }

      if (isRoleDirty && onRoleChange) {
        await onRoleChange(editRole)
      }
    },
    onSuccess: () => {
      toast.success(t('profile.updateSuccess'))
      invalidateStaffProfileCaches()
      queryClient.invalidateQueries({ queryKey: ['contractor-agreement-status'] })
      queryClient.invalidateQueries({ queryKey: ['contractor-agreement-acceptance'] })
      // Title changes affect NDA readiness for the current staff.
      if (isOwnProfile) invalidateReadiness()
      setIsEditing(false)
    },
    onError: (error: Error) => {
      toast.error(error.message || t('profile.updateError'))
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
    setEditTitle(staff.title ?? '')
    setEditPhoneNumber(staff.phoneNumber as E164Number | undefined)
    setEditNotifyOnUpload(staff.notifyOnUpload)
    setEditRole(staffRoleToAppRole(staff.role))
    setEditIsContractorAgent(staff.isContractorAgent)
    setFirstNameError(null)
    setLastNameError(null)
    setPhoneError(null)
    setIsEditing(false)
  }

  const roleLabel = staff.role === 'ADMIN'
    ? t('team.admin')
    : staff.role === 'MANAGER'
      ? t('team.manager')
      : staff.role === 'CPA'
        ? t('team.cpa', 'CPA')
        : t('team.member')
  const isDirty = isProfileDirty || isRoleDirty || isContractorAgentDirty

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
              onChange={(e) => setEditRole(e.target.value as AppRole)}
              disabled={isRoleChangePending}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            >
              <option value="ADMIN">{t('team.admin')}</option>
              <option value="MANAGER">{t('team.manager')}</option>
              <option value="MEMBER">{t('team.member')}</option>
            </select>
          ) : (
            <p className="text-foreground">
              {roleLabel}
            </p>
          )}
        </div>

        {/* Contractor Agent flag */}
        <div>
          <label htmlFor="contractorAgent" className="block text-sm font-medium text-foreground mb-1.5">
            {t('profile.contractorAgent', 'Contractor Agent')}
          </label>
          {isEditing && canManageContractorAgent ? (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">
                  {t('profile.contractorAgent', 'Contractor Agent')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('profile.contractorAgentHelp', 'Requires Independent Contractor agreement on next login.')}
                </p>
              </div>
              <Switch
                id="contractorAgent"
                checked={editIsContractorAgent}
                onCheckedChange={setEditIsContractorAgent}
              />
            </div>
          ) : (
            <p className="text-foreground">
              {staff.isContractorAgent ? t('common.yes') : t('common.no')}
            </p>
          )}
        </div>

        {/* Title (e.g. Managing Partner, CPA) */}
        <div data-settings-focus="title">
          <label htmlFor="title" className="block text-sm font-medium text-foreground mb-1.5">
            Title
          </label>
          {isEditing ? (
            <Input
              id="title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={80}
              placeholder="e.g. Managing Partner, CPA"
            />
          ) : (
            <p className="text-foreground">
              {staff.title || <span className="text-muted-foreground">{t('profile.notSet')}</span>}
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

        {/* Notification Preferences - hidden when shown in separate settings tab */}
        {!hideNotifications && (
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
        )}

        {/* Terms & Conditions */}
        <div className="border-t border-border pt-6 mt-6">
          <h3 className="text-sm font-medium text-foreground mb-4">
            {t('profile.termsAndConditions', 'Terms & Conditions')}
          </h3>
          <TermsDownloadButton staffId={staffId} />
          <div className="mt-5 pt-5 border-t border-border/60">
            <h3 className="text-sm font-medium text-foreground mb-4">
              {t('profile.independentContractorAgreement', 'Independent Contractor Agreement')}
            </h3>
            <ContractorAgreementDownloadButton
              staffId={staffId}
              isContractorAgent={staff.isContractorAgent}
              canViewAgreement={canViewContractorAgreement}
            />
          </div>
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
