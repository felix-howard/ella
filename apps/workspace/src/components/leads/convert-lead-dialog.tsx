/**
 * Convert Lead Dialog - Convert lead to client with duplicate phone check
 * Includes editable lead fields and SMS customization panel
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle, MessageSquare, Info } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import { formatPhone } from '../../lib/formatters'
import { DEFAULT_SMS_TEMPLATE_VI, DEFAULT_SMS_TEMPLATE_EN } from '../clients/confirm-step'
import type { Lead } from '../../lib/api-client'

interface ConvertLeadDialogProps {
  lead: Lead
  onClose: () => void
}

const currentYear = new Date().getFullYear()
const TAX_YEARS = [currentYear - 1, currentYear - 2, currentYear - 3]

const SMS_TEMPLATES: Record<'EN' | 'VI', string> = {
  EN: DEFAULT_SMS_TEMPLATE_EN,
  VI: DEFAULT_SMS_TEMPLATE_VI,
}

export function ConvertLeadDialog({ lead, onClose }: ConvertLeadDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [managedById, setManagedById] = useState('')
  const [taxYear, setTaxYear] = useState(currentYear - 1)
  const [sendWelcomeSms, setSendWelcomeSms] = useState(true)

  // Editable lead fields
  const [editedFirstName, setEditedFirstName] = useState(lead.firstName)
  const [editedLastName, setEditedLastName] = useState(lead.lastName)
  const [editedEmail, setEditedEmail] = useState(lead.email || '')

  // SMS customization - default to Vietnamese
  const [smsLanguage, setSmsLanguage] = useState<'EN' | 'VI'>('VI')
  const [customMessage, setCustomMessage] = useState(SMS_TEMPLATES['VI'])

  // Check for duplicate phone
  const { data: convertCheck } = useQuery({
    queryKey: ['lead-convert-check', lead.id],
    queryFn: () => api.leads.convertCheck(lead.id),
  })

  // Fetch staff list for managedBy dropdown
  const { data: teamData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    staleTime: 60000,
  })

  const convertMutation = useMutation({
    mutationFn: () => api.leads.convert(lead.id, {
      managedById: managedById || undefined,
      language: smsLanguage,
      taxYear,
      sendWelcomeSms,
      customMessage: sendWelcomeSms && customMessage ? customMessage : undefined,
      firstName: editedFirstName.trim() !== lead.firstName ? editedFirstName.trim() : undefined,
      lastName: editedLastName.trim() !== lead.lastName ? editedLastName.trim() : undefined,
      email: editedEmail !== (lead.email || '') ? (editedEmail || null) : undefined,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
      navigate({ to: '/clients/$clientId', params: { clientId: data.clientId } })
    },
  })

  const staffMembers = teamData?.data?.filter((m) => m.isActive) ?? []

  const handleSmsLanguageChange = (lang: 'EN' | 'VI') => {
    // Only overwrite if message matches current template (not customized)
    const isDefault = customMessage === SMS_TEMPLATES[smsLanguage]
    setSmsLanguage(lang)
    if (isDefault) {
      setCustomMessage(SMS_TEMPLATES[lang])
    }
  }

  const clientName = `${editedFirstName} ${editedLastName}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-card rounded-t-xl z-10 px-6 pt-6 pb-4 border-b border-border/50">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t('leads.convertTitle')}</h2>
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{t('leads.convertDesc')}</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Duplicate Phone Warning */}
          {convertCheck?.hasDuplicate && convertCheck.existingClient && (
            <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  {t('leads.duplicateWarning', {
                    name: `${convertCheck.existingClient.firstName} ${convertCheck.existingClient.lastName}`
                  })}
                </p>
                <p className="text-yellow-600 mt-0.5">{t('leads.duplicateConfirm')}</p>
              </div>
            </div>
          )}

          {/* Lead Info - Editable */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">{t('leads.leadInfo')}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('leads.firstName')}</label>
                <input
                  value={editedFirstName}
                  onChange={(e) => setEditedFirstName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('leads.lastName')}</label>
                <input
                  value={editedLastName}
                  onChange={(e) => setEditedLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t('leads.email')}</label>
              <input
                value={editedEmail}
                onChange={(e) => setEditedEmail(e.target.value)}
                type="email"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                placeholder={t('leads.emailPlaceholder')}
              />
            </div>
            <div className="text-sm text-muted-foreground">{formatPhone(lead.phone)}</div>
          </section>

          {/* Managed By */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('leads.managedBy')}</label>
            <select
              value={managedById}
              onChange={(e) => setManagedById(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm"
            >
              <option value="">{t('leads.selectStaff')}</option>
              {staffMembers.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Tax Year */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('leads.taxYear')}</label>
            <div className="flex gap-2">
              {TAX_YEARS.map((year) => (
                <button
                  key={year}
                  type="button"
                  onClick={() => setTaxYear(year)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    taxYear === year ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>

          {/* Send Upload Link SMS - Custom Checkbox */}
          <label className="relative flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWelcomeSms}
              onChange={(e) => {
                setSendWelcomeSms(e.target.checked)
                if (e.target.checked && !customMessage) {
                  setCustomMessage(SMS_TEMPLATES[smsLanguage])
                }
              }}
              className="peer sr-only"
            />
            <div className="h-4 w-4 rounded border-2 border-muted-foreground/40 peer-checked:border-emerald-500 peer-checked:bg-emerald-500 transition-colors flex items-center justify-center">
              {sendWelcomeSms && (
                <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm">{t('leads.sendUploadLinkSms')}</span>
          </label>

          {/* SMS Customization Panel - styled like confirm-step */}
          {sendWelcomeSms && (
            <div className="bg-muted/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-foreground">{t('confirmStep.messagePreview')}</span>
                </div>
                <div className="flex items-center gap-1 bg-card rounded-lg p-1 border border-border">
                  <button
                    type="button"
                    onClick={() => handleSmsLanguageChange('VI')}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                      smsLanguage === 'VI'
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    VN
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSmsLanguageChange('EN')}
                    className={cn(
                      'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                      smsLanguage === 'EN'
                        ? 'bg-primary text-white'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    EN
                  </button>
                </div>
              </div>

              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                rows={4}
                className={cn(
                  'w-full px-3 py-2.5 rounded-lg border bg-card text-sm text-foreground',
                  'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
                  'placeholder:text-muted-foreground resize-none border-border'
                )}
                placeholder={t('leads.smsPlaceholder')}
              />

              {/* Placeholder Guide */}
              <div className="p-3 bg-card/50 rounded-lg border border-border/50">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="font-medium">{t('confirmStep.placeholderGuide')}</p>
                    <ul className="space-y-0.5 ml-2">
                      <li><code className="bg-muted px-1 rounded">{'{{client_name}}'}</code> → {clientName}</li>
                      <li><code className="bg-muted px-1 rounded">{'{{tax_year}}'}</code> → {taxYear}</li>
                      <li><code className="bg-muted px-1 rounded">{'{{portal_link}}'}</code> → {t('confirmStep.autoGenerated')}</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {convertMutation.error && (
            <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
              {t('leads.convertError')}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="sticky bottom-0 bg-card rounded-b-xl px-6 py-4 border-t border-border/50 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending || !editedFirstName.trim() || !editedLastName.trim()}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              convertMutation.isPending || !editedFirstName.trim() || !editedLastName.trim()
                ? 'bg-primary/70 cursor-not-allowed'
                : 'bg-primary hover:bg-primary/90'
            )}
          >
            {convertMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('leads.converting')}
              </span>
            ) : t('leads.convertButton')}
          </button>
        </div>
      </div>
    </div>
  )
}
