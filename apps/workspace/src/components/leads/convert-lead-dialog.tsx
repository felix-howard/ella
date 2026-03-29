/**
 * Convert Lead Dialog - Convert lead to client with duplicate phone check
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import { cn } from '@ella/ui'
import { api } from '../../lib/api-client'
import type { Lead, Language } from '../../lib/api-client'

interface ConvertLeadDialogProps {
  lead: Lead
  onClose: () => void
}

const currentYear = new Date().getFullYear()
const TAX_YEARS = [currentYear - 1, currentYear - 2, currentYear - 3]

export function ConvertLeadDialog({ lead, onClose }: ConvertLeadDialogProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [managedById, setManagedById] = useState('')
  const [language, setLanguage] = useState<Language>('VI')
  const [taxYear, setTaxYear] = useState(currentYear - 1)
  const [sendWelcomeSms, setSendWelcomeSms] = useState(true)

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
      language,
      taxYear,
      sendWelcomeSms,
    }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      onClose()
      navigate({ to: '/clients/$clientId', params: { clientId: data.clientId } })
    },
  })

  const staffMembers = teamData?.data?.filter((m) => m.isActive) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative bg-card rounded-xl shadow-lg w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{t('leads.convertTitle')}</h2>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">{t('leads.convertDesc')}</p>

        {/* Lead Info */}
        <div className="bg-muted/50 rounded-lg p-3 mb-4 text-sm">
          <div className="font-medium">{lead.firstName} {lead.lastName}</div>
          <div className="text-muted-foreground">{lead.phone}</div>
          {lead.email && <div className="text-muted-foreground">{lead.email}</div>}
        </div>

        {/* Duplicate Phone Warning */}
        {convertCheck?.hasDuplicate && convertCheck.existingClient && (
          <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm">
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

        <div className="space-y-4">
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

          {/* Language */}
          <div>
            <label className="block text-sm font-medium mb-1">{t('leads.language')}</label>
            <div className="flex gap-2">
              {(['VI', 'EN'] as const).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setLanguage(lang)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                    language === lang ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                  )}
                >
                  {lang === 'VI' ? 'Tiếng Việt' : 'English'}
                </button>
              ))}
            </div>
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

          {/* Send Welcome SMS */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendWelcomeSms}
              onChange={(e) => setSendWelcomeSms(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm">{t('leads.sendWelcomeSms')}</span>
          </label>
        </div>

        {/* Error */}
        {convertMutation.error && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            {t('leads.convertError')}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            {t('common.cancel')}
          </button>
          <button
            onClick={() => convertMutation.mutate()}
            disabled={convertMutation.isPending}
            className={cn(
              'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
              convertMutation.isPending ? 'bg-primary/70 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'
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
