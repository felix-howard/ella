import { useId, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle, cn } from '@ella/ui'
import { api, type IntakeLinkStaffRow, type Language, type UploadLinkTemplateId } from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { UploadLinkMessageSettings } from './upload-link-message-settings'

interface IntakeLinkSettingsModalProps {
  staff: IntakeLinkStaffRow | null
  open: boolean
  onClose: () => void
}
function validateOptionalSlug(value: string) {
  if (!value) return null
  if (!/^[a-z0-9-]+$/.test(value)) return 'settings.slugInvalidFormat'
  if (value.length < 2 || value.length > 50) return 'settings.slugInvalidLength'
  return null
}

export function IntakeLinkSettingsModal({ staff, open, onClose }: IntakeLinkSettingsModalProps) {
  if (!staff) return null

  return (
    <IntakeLinkSettingsModalContent
      key={staff.id}
      staff={staff}
      open={open}
      onClose={onClose}
    />
  )
}

function IntakeLinkSettingsModalContent({
  staff,
  open,
  onClose,
}: {
  staff: IntakeLinkStaffRow
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const titleId = useId()
  const descriptionId = useId()
  const queryClient = useQueryClient()
  const [formSlug, setFormSlug] = useState(staff.formSlug ?? '')
  const [useOrgDefaults, setUseOrgDefaults] = useState(staff.useOrgUploadLinkDefaults)
  const [autoSend, setAutoSend] = useState(staff.autoSendUploadLink)
  const [language, setLanguage] = useState<Language>(
    staff.defaultUploadLinkLanguage ?? staff.effectiveDefaultUploadLinkLanguage
  )
  const [templateId, setTemplateId] = useState<UploadLinkTemplateId | null>(staff.defaultUploadLinkTemplateId)
  const [slugError, setSlugError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () => {
      return api.staff.updateIntakeLink(staff.id, {
        formSlug: formSlug.trim() || null,
        useOrgUploadLinkDefaults: useOrgDefaults,
        autoSendUploadLink: autoSend,
        defaultUploadLinkLanguage: language,
        defaultUploadLinkTemplateId: templateId,
      })
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['org-intake-links'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-me'] }),
        queryClient.invalidateQueries({ queryKey: ['assignable-staff'] }),
        queryClient.invalidateQueries({ queryKey: ['team-member-profile'] }),
      ])
      toast.success(t('settings.saved'))
      onClose()
    },
    onError: (err: Error) => {
      if (err.message.includes('SLUG_TAKEN')) {
        setSlugError(t('settings.slugTaken'))
        return
      }
      toast.error(err.message || t('settings.saveFailed'))
    },
  })

  const handleSave = () => {
    const trimmedSlug = formSlug.trim().toLowerCase()
    const errorKey = validateOptionalSlug(trimmedSlug)
    if (errorKey) {
      setSlugError(t(errorKey))
      return
    }
    setFormSlug(trimmedSlug)
    setSlugError(null)
    mutation.mutate()
  }

  const isSaving = mutation.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
    >
      <ModalHeader>
        <ModalTitle id={titleId}>{t('settings.editStaffIntakeLink', { name: staff?.name ?? '' })}</ModalTitle>
        <ModalDescription id={descriptionId}>
          {t('settings.editStaffIntakeLinkDescription')}
        </ModalDescription>
      </ModalHeader>

      <ModalBody className="space-y-5">
        <div className="space-y-2">
          <label htmlFor="staff-intake-slug" className="text-xs font-medium text-foreground">
            {t('settings.staffUrlSlug')}
          </label>
          <Input
            id="staff-intake-slug"
            value={formSlug}
            onChange={(event) => {
              setFormSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              setSlugError(null)
            }}
            placeholder="jane-smith"
            disabled={isSaving}
          />
          {slugError ? (
            <p className="text-xs text-destructive">{slugError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('settings.staffUrlSlugHint')}</p>
          )}
          {staff?.formSlug && staff.formSlug !== formSlug && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              {t('settings.staffSlugChangeWarning')}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('settings.uploadMessageBehavior')}</p>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={t('settings.uploadMessageBehavior')}>
            <label
              className={cn(
                'cursor-pointer rounded-lg border p-3 text-left transition-colors',
                useOrgDefaults ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50',
                isSaving && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                type="radio"
                name="staff-upload-message-behavior"
                checked={useOrgDefaults}
                onChange={() => setUseOrgDefaults(true)}
                disabled={isSaving}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-foreground">{t('settings.useOrganizationDefault')}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t('settings.useOrganizationDefaultDescription')}</span>
            </label>
            <label
              className={cn(
                'cursor-pointer rounded-lg border p-3 text-left transition-colors',
                !useOrgDefaults ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/50',
                isSaving && 'cursor-not-allowed opacity-60'
              )}
            >
              <input
                type="radio"
                name="staff-upload-message-behavior"
                checked={!useOrgDefaults}
                onChange={() => setUseOrgDefaults(false)}
                disabled={isSaving}
                className="sr-only"
              />
              <span className="block text-sm font-medium text-foreground">{t('settings.useCustomUploadMessage')}</span>
              <span className="mt-1 block text-xs text-muted-foreground">{t('settings.useCustomUploadMessageDescription')}</span>
            </label>
          </div>
        </div>

        {!useOrgDefaults && (
          <UploadLinkMessageSettings
            autoSend={autoSend}
            language={language}
            templateId={templateId}
            disabled={isSaving}
            name={`staffUploadLinkTemplate-${staff?.id ?? 'new'}`}
            onAutoSendChange={setAutoSend}
            onLanguageChange={setLanguage}
            onTemplateChange={setTemplateId}
            allowDefaultTemplate
          />
        )}
      </ModalBody>

      <ModalFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          {t('common.cancel')}
        </Button>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </ModalFooter>
    </Modal>
  )
}
