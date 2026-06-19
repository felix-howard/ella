import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from '@ella/ui'
import { Loader2 } from 'lucide-react'
import type { CompanyVaultCredential, CompanyVaultInput } from '../../lib/api-client'

interface CompanyVaultFormModalProps {
  open: boolean
  credential?: CompanyVaultCredential | null
  isPending?: boolean
  onClose: () => void
  onSubmit: (input: CompanyVaultInput) => void
}

interface CompanyVaultFormState {
  toolName: string
  username: string
  password: string
  note: string
}

function buildInitialState(credential?: CompanyVaultCredential | null): CompanyVaultFormState {
  return {
    toolName: credential?.toolName ?? '',
    username: credential?.username ?? '',
    password: credential?.password ?? '',
    note: credential?.note ?? '',
  }
}

function optionalSecret(value: string): string | null {
  return value === '' ? null : value
}

export function CompanyVaultFormModal({
  open,
  credential,
  isPending = false,
  onClose,
  onSubmit,
}: CompanyVaultFormModalProps) {
  if (!open) return null

  return (
    <CompanyVaultFormModalContent
      key={credential?.id ?? 'new'}
      credential={credential}
      isPending={isPending}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  )
}

function CompanyVaultFormModalContent({
  credential,
  isPending,
  onClose,
  onSubmit,
}: Omit<CompanyVaultFormModalProps, 'open'>) {
  const { t } = useTranslation()
  const initialState = useMemo(() => buildInitialState(credential), [credential])
  const [form, setForm] = useState<CompanyVaultFormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const isEdit = Boolean(credential)
  const toolNameErrorId = 'company-vault-tool-name-error'

  const updateField = (field: keyof CompanyVaultFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setError(null)
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const toolName = form.toolName.trim()
    if (!toolName) {
      setError(t('companyVault.toolNameRequired'))
      return
    }
    onSubmit({
      toolName,
      username: optionalSecret(form.username),
      password: optionalSecret(form.password),
      note: optionalSecret(form.note),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      closeOnEscape={!isPending}
      closeOnOverlayClick={!isPending}
      showCloseButton={!isPending}
      aria-labelledby="company-vault-form-title"
      aria-describedby="company-vault-form-description"
    >
      <form onSubmit={handleSubmit}>
        <ModalHeader>
          <ModalTitle id="company-vault-form-title">
            {isEdit ? t('companyVault.editTitle') : t('companyVault.addTitle')}
          </ModalTitle>
          <ModalDescription id="company-vault-form-description">
            {t('companyVault.formDescription')}
          </ModalDescription>
        </ModalHeader>
        <ModalBody className="space-y-4">
          <div>
            <label htmlFor="company-vault-tool-name" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('companyVault.toolName')}
            </label>
            <Input
              id="company-vault-tool-name"
              value={form.toolName}
              onChange={(event) => updateField('toolName', event.target.value)}
              placeholder={t('companyVault.toolNamePlaceholder')}
              disabled={isPending}
              required
              autoFocus
              maxLength={120}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? toolNameErrorId : undefined}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="company-vault-username" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('companyVault.username')}
              </label>
              <Input
                id="company-vault-username"
                value={form.username}
                onChange={(event) => updateField('username', event.target.value)}
                placeholder={t('companyVault.usernamePlaceholder')}
                disabled={isPending}
                maxLength={500}
                autoComplete="off"
              />
            </div>
            <div>
              <label htmlFor="company-vault-password" className="mb-1.5 block text-sm font-medium text-foreground">
                {t('companyVault.password')}
              </label>
              <Input
                id="company-vault-password"
                value={form.password}
                onChange={(event) => updateField('password', event.target.value)}
                placeholder={t('companyVault.passwordPlaceholder')}
                disabled={isPending}
                maxLength={500}
                autoComplete="off"
              />
            </div>
          </div>
          <div>
            <label htmlFor="company-vault-note" className="mb-1.5 block text-sm font-medium text-foreground">
              {t('companyVault.note')}
            </label>
            <textarea
              id="company-vault-note"
              value={form.note}
              onChange={(event) => updateField('note', event.target.value)}
              placeholder={t('companyVault.notePlaceholder')}
              disabled={isPending}
              maxLength={2000}
              rows={4}
              className="w-full rounded-lg border border-input bg-card px-3.5 py-2.5 text-sm text-foreground transition-all duration-200 placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {error && (
            <p id={toolNameErrorId} className="rounded-lg bg-error-light p-2 text-sm text-error" role="alert">
              {error}
            </p>
          )}
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={isPending || !form.toolName.trim()} className="gap-2">
            {isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {isEdit ? t('companyVault.saveChanges') : t('companyVault.createCredential')}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  )
}
