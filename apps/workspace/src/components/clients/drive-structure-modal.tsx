import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FolderPlus, Loader2, Shield, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button, Input, Modal, ModalBody, ModalDescription, ModalFooter, ModalHeader, ModalTitle, Switch } from '@ella/ui'
import type { ClientDriveBusinessMode, ClientDriveStructureCreateInput, ClientDriveStructureOptionsDto } from '@ella/shared'
import { api } from '../../lib/api-client'

interface DriveStructureModalProps { open: boolean; clientId: string; isPending: boolean; onClose: () => void; onSubmit: (input: ClientDriveStructureCreateInput) => void }
interface FormState { ssnLast4: string; state: string; businessMode: ClientDriveBusinessMode; businessName: string; accountManagerStaffIds: string[]; clientEmail: string; sendNotificationEmail: boolean }

function buildInitialForm(options: ClientDriveStructureOptionsDto): FormState {
  return { ssnLast4: '', state: options.defaultState ?? '', businessMode: options.defaultBusinessMode, businessName: options.defaultBusinessName ?? '', accountManagerStaffIds: options.selectedAccountManagerStaffIds, clientEmail: options.clientEmail ?? '', sendNotificationEmail: false }
}

export function DriveStructureModal({ open, clientId, isPending, onClose, onSubmit }: DriveStructureModalProps) {
  if (!open) return null
  return <DriveStructureModalContent key={clientId} clientId={clientId} isPending={isPending} onClose={onClose} onSubmit={onSubmit} />
}

function DriveStructureModalContent({ clientId, isPending, onClose, onSubmit }: Omit<DriveStructureModalProps, 'open'>) {
  const { t } = useTranslation()
  const { data: options, isLoading, isError } = useQuery({ queryKey: ['client-drive-options', clientId], queryFn: () => api.clients.driveStructure.options(clientId) })
  const [form, setForm] = useState<FormState | null>(null)
  const initialForm = form ?? (options ? buildInitialForm(options) : null)
  const [error, setError] = useState<string | null>(null)
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => { setForm((previous) => ({ ...(previous ?? buildInitialForm(options!)), [key]: value })); setError(null) }
  const preview = useMemo(() => initialForm && options && /^\d{4}$/.test(initialForm.ssnLast4) && /^[A-Za-z]{2}$/.test(initialForm.state.trim()) && (initialForm.businessMode === 'MULTI' || initialForm.businessName.trim()) ? `${options.clientName} ${initialForm.ssnLast4} - ${initialForm.state.trim().toUpperCase()} - ${initialForm.businessMode === 'MULTI' ? 'Multi' : initialForm.businessName.trim().replace(/\s+/g, ' ')}` : t('googleDrive.previewIncomplete'), [initialForm, options, t])
  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!initialForm || !/^\d{4}$/.test(initialForm.ssnLast4) || !/^[A-Za-z]{2}$/.test(initialForm.state.trim()) || !initialForm.clientEmail.trim() || (initialForm.businessMode === 'SINGLE_BUSINESS' && !initialForm.businessName.trim())) { setError(t('googleDrive.validationError')); return }
    onSubmit({ ssnLast4: initialForm.ssnLast4, state: initialForm.state.trim().toUpperCase(), businessMode: initialForm.businessMode, businessName: initialForm.businessMode === 'SINGLE_BUSINESS' ? initialForm.businessName.trim() : undefined, accountManagerStaffIds: initialForm.accountManagerStaffIds, clientEmail: initialForm.clientEmail.trim(), sendNotificationEmail: initialForm.sendNotificationEmail })
  }
  const canSubmit = Boolean(initialForm && /^\d{4}$/.test(initialForm.ssnLast4) && /^[A-Za-z]{2}$/.test(initialForm.state.trim()) && initialForm.clientEmail.trim() && (initialForm.businessMode === 'MULTI' || initialForm.businessName.trim()))
  return <Modal open onClose={onClose} size="lg" closeOnEscape={!isPending} closeOnOverlayClick={!isPending} showCloseButton={!isPending} aria-labelledby="drive-structure-title" aria-describedby="drive-structure-description"><form onSubmit={submit}><ModalHeader><ModalTitle id="drive-structure-title">{t('googleDrive.modalTitle')}</ModalTitle><ModalDescription id="drive-structure-description">{t('googleDrive.modalDescription')}</ModalDescription></ModalHeader><ModalBody className="max-h-[65vh] space-y-4 overflow-y-auto">
    {isLoading ? <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" aria-label={t('googleDrive.loading')} /></div> : isError || !initialForm || !options ? <p className="rounded-lg bg-error-light p-3 text-sm text-error" role="alert">{t('googleDrive.optionsError')}</p> : <>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor="drive-ssn-last4" className="mb-1.5 block text-sm font-medium">{t('googleDrive.ssnLast4')}</label><Input id="drive-ssn-last4" inputMode="numeric" maxLength={4} value={initialForm.ssnLast4} onChange={(e) => update('ssnLast4', e.target.value.replace(/\D/g, ''))} disabled={isPending} /></div><div><label htmlFor="drive-state" className="mb-1.5 block text-sm font-medium">{t('googleDrive.state')}</label><Input id="drive-state" maxLength={2} value={initialForm.state} onChange={(e) => update('state', e.target.value.toUpperCase())} disabled={isPending} /></div></div>
      <fieldset><legend className="mb-1.5 text-sm font-medium">{t('googleDrive.businessNaming')}</legend><div className="flex flex-wrap gap-3"><label className="flex items-center gap-2 text-sm"><input type="radio" checked={initialForm.businessMode === 'MULTI'} onChange={() => update('businessMode', 'MULTI')} disabled={isPending} />{t('googleDrive.multi')}</label><label className="flex items-center gap-2 text-sm"><input type="radio" checked={initialForm.businessMode === 'SINGLE_BUSINESS'} onChange={() => update('businessMode', 'SINGLE_BUSINESS')} disabled={isPending} />{t('googleDrive.singleBusiness')}</label></div></fieldset>
      {initialForm.businessMode === 'SINGLE_BUSINESS' && <div><label htmlFor="drive-business-name" className="mb-1.5 block text-sm font-medium">{t('googleDrive.businessName')}</label><Input id="drive-business-name" value={initialForm.businessName} onChange={(e) => update('businessName', e.target.value)} disabled={isPending} /></div>}
      <div><label htmlFor="drive-client-email" className="mb-1.5 block text-sm font-medium">{t('googleDrive.clientEmail')}</label><Input id="drive-client-email" type="email" required value={initialForm.clientEmail} onChange={(e) => update('clientEmail', e.target.value)} disabled={isPending} /></div>
      <div><p className="mb-1.5 text-sm font-medium"><Users className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('googleDrive.accountManagers')}</p><div className="grid gap-2 sm:grid-cols-2">{options.staffOptions.map((staff) => <label key={staff.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={initialForm.accountManagerStaffIds.includes(staff.id)} onChange={(event) => update('accountManagerStaffIds', event.target.checked ? [...initialForm.accountManagerStaffIds, staff.id] : initialForm.accountManagerStaffIds.filter((id) => id !== staff.id))} disabled={isPending} />{staff.name}</label>)}</div></div>
      <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3 text-sm"><span>{t('googleDrive.sendNotification')}</span><Switch checked={initialForm.sendNotificationEmail} onCheckedChange={(checked) => update('sendNotificationEmail', checked)} disabled={isPending} /></label>
      <div className="rounded-lg bg-muted/50 p-3 text-sm"><p className="font-medium">{t('googleDrive.folderPreview')}</p><p className="mt-1 break-words text-muted-foreground">{preview}</p><ul className="mt-3 space-y-1 text-muted-foreground"><li><FolderPlus className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('googleDrive.folderTreeAm')}</li><li><Shield className="mr-1 inline h-4 w-4" aria-hidden="true" />{t('googleDrive.folderTreeAdmin')}</li></ul><p className="mt-3 font-medium">{t('googleDrive.permissionPreview')}</p><ul className="mt-1 space-y-1 text-muted-foreground"><li>{t('googleDrive.permissionManagers', { names: options.staffOptions.filter((staff) => initialForm.accountManagerStaffIds.includes(staff.id)).map((staff) => staff.name).join(', ') || t('googleDrive.none') })}</li><li>{t('googleDrive.permissionAdmins')}</li><li>{t('googleDrive.permissionClient', { email: initialForm.clientEmail || t('googleDrive.none') })}</li></ul></div>
      {error && <p className="rounded-lg bg-error-light p-3 text-sm text-error" role="alert">{error}</p>}
    </>}
  </ModalBody><ModalFooter><Button type="button" variant="outline" onClick={onClose} disabled={isPending}>{t('common.cancel')}</Button><Button type="submit" disabled={isPending || isLoading || isError || !canSubmit}>{isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />}{t('googleDrive.createStructure')}</Button></ModalFooter></form></Modal>
}
