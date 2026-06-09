/**
 * Bulk SMS Dialog - Send SMS to multiple selected leads
 * Supports {{firstName}} and {{formLink}} placeholders
 */
import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, AlertCircle, User, Link2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { api, ApiError, type BulkSmsResponse, type Lead } from '../../lib/api-client'
import { PORTAL_BASE_URL } from '../../lib/constants'
import { BulkSmsResultSummary } from './bulk-sms-result-summary'

interface BulkSmsDialogProps {
  leadIds: string[]
  selectedCount: number
  previewLead?: Lead
  maxRecipients: number
  onClose: () => void
}

type SendState = 'idle' | 'sending' | 'success' | 'partial' | 'error'

export function BulkSmsDialog({ leadIds, selectedCount, previewLead, maxRecipients, onClose }: BulkSmsDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [message, setMessage] = useState('')
  const [formLinkType, setFormLinkType] = useState<'org' | 'staff'>('org')
  const [staffSlug, setStaffSlug] = useState('')
  const [sendState, setSendState] = useState<SendState>('idle')
  const [activeLeadIds, setActiveLeadIds] = useState(leadIds)
  const [result, setResult] = useState<BulkSmsResponse | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const targetCount = activeLeadIds.length || selectedCount || leadIds.length
  const activePreviewLead = previewLead && activeLeadIds.includes(previewLead.id) ? previewLead : undefined

  // Fetch staff list for staff-specific form link dropdown
  const { data: staffData } = useQuery({
    queryKey: ['team-members'],
    queryFn: () => api.team.listMembers(),
    enabled: formLinkType === 'staff',
  })

  // Fetch org settings for slug (form URL)
  const { data: orgSettings } = useQuery({
    queryKey: ['org-settings'],
    queryFn: () => api.orgSettings.get(),
  })

  const orgSlug = orgSettings?.slug || ''

  // Only show staff who have formSlug configured
  const staffWithFormSlug = useMemo(
    () => staffData?.data?.filter((s) => s.formSlug) ?? [],
    [staffData]
  )

  // Build preview form URL
  const formLinkPreview = useMemo(() => {
    if (!orgSlug) return ''
    if (formLinkType === 'staff' && staffSlug) {
      return `${PORTAL_BASE_URL}/form/${orgSlug}/${staffSlug}`
    }
    return `${PORTAL_BASE_URL}/form/${orgSlug}`
  }, [formLinkType, staffSlug, orgSlug])

  // Resolve preview message for first lead
  const previewMessage = useMemo(() => {
    if (!activePreviewLead) return message
    return message
      .replace(/\{\{firstName\}\}/g, activePreviewLead.firstName)
      .replace(/\{\{formLink\}\}/g, formLinkPreview)
  }, [message, activePreviewLead, formLinkPreview])

  // Insert placeholder at cursor position
  const insertPlaceholder = (placeholder: string) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newMessage = message.slice(0, start) + placeholder + message.slice(end)
    setMessage(newMessage)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
    }, 0)
  }

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: () => api.leads.bulkSms({
      leadIds: activeLeadIds,
      message,
      formLinkType,
      staffSlug: formLinkType === 'staff' ? staffSlug : undefined,
    }),
    onSuccess: (data) => {
      setResult(data)
      setSendError(null)
      if (data.failed === 0) setSendState('success')
      else if (data.sent > 0) setSendState('partial')
      else setSendState('error')
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      queryClient.invalidateQueries({ queryKey: ['leads-stats'] })
      activeLeadIds.forEach((id) => {
        queryClient.invalidateQueries({ queryKey: ['lead', id] })
        queryClient.invalidateQueries({ queryKey: ['messages', 'lead', id] })
      })
    },
    onError: (error) => {
      setSendError(getBulkSmsErrorMessage(error))
      setSendState('error')
    },
  })

  const handleSend = () => {
    if (!message.trim()) return
    if (formLinkType === 'staff' && !staffSlug) return
    if (activeLeadIds.length === 0 || activeLeadIds.length > maxRecipients) return
    setSendState('sending')
    setResult(null)
    setSendError(null)
    sendMutation.mutate()
  }

  const handleRetryFailed = () => {
    if (!result) return
    const failedLeadIds = result.results
      .filter((item) => item.status === 'failed')
      .map((item) => item.leadId)
    setActiveLeadIds(failedLeadIds)
    setResult(null)
    setSendError(null)
    setSendState('idle')
  }

  const charCount = previewMessage.length
  const isOverLimit = charCount > 160

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={sendState === 'idle' ? onClose : undefined} />

      <div className="relative bg-card rounded-xl shadow-lg w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h2 className="text-lg font-semibold">{t('bulkSms.title')}</h2>
            <p className="text-sm text-muted-foreground">
              {t('bulkSms.subtitle', { count: targetCount })}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('bulkSms.maxRecipients', { limit: maxRecipients })}
            </p>
          </div>
          {sendState !== 'sending' && (
            <button onClick={onClose} className="p-1 hover:bg-muted rounded-lg">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(sendState === 'success' || sendState === 'partial' || (sendState === 'error' && result)) && result && (
            <BulkSmsResultSummary
              result={result}
              attemptedCount={result.sent + result.failed}
              onRetryFailed={handleRetryFailed}
              onClose={onClose}
            />
          )}

          {/* Error */}
          {sendState === 'error' && !result && (
            <div className="flex flex-col items-center py-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
              <p className="text-lg font-medium">{t('bulkSms.error')}</p>
              {sendError && <p className="mt-2 max-w-sm text-sm text-muted-foreground">{sendError}</p>}
              <button onClick={() => { setSendState('idle'); setResult(null); setSendError(null) }} className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium">
                {t('common.retry')}
              </button>
            </div>
          )}

          {/* Sending */}
          {sendState === 'sending' && (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="w-10 h-10 text-primary animate-spin mb-3" />
              <p className="text-muted-foreground">
                {t('bulkSms.sending', { sent: '...', total: targetCount })}
              </p>
            </div>
          )}

          {/* Compose */}
          {sendState === 'idle' && (
            <>
              {/* Message Input */}
              <div>
                <textarea
                  ref={textareaRef}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('bulkSms.messagePlaceholder')}
                  rows={4}
                  className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />

                {/* Placeholder Buttons */}
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{{firstName}}')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <User className="w-3.5 h-3.5" />
                    {t('bulkSms.insertName')}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{{formLink}}')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted rounded-lg hover:bg-muted/80 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    {t('bulkSms.insertFormLink')}
                  </button>
                </div>

                {/* Char Count */}
                <div className="flex items-center justify-between mt-2 text-xs">
                  <span className={cn('text-muted-foreground', isOverLimit && 'text-yellow-600')}>
                    {t('bulkSms.charCount', { count: charCount })}
                  </span>
                  {isOverLimit && (
                    <span className="text-yellow-600">{t('bulkSms.charWarning')}</span>
                  )}
                </div>
              </div>

              {/* Form Link Config */}
              <div>
                <label className="block text-sm font-medium mb-2">{t('bulkSms.formLinkType')}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setFormLinkType('org'); setStaffSlug('') }}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      formLinkType === 'org' ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    {t('bulkSms.formLinkOrg')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormLinkType('staff')}
                    className={cn(
                      'flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      formLinkType === 'staff' ? 'bg-primary text-white' : 'bg-muted text-foreground hover:bg-muted/80'
                    )}
                  >
                    {t('bulkSms.formLinkStaff')}
                  </button>
                </div>

                {formLinkType === 'staff' && (
                  <select
                    value={staffSlug}
                    onChange={(e) => setStaffSlug(e.target.value)}
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-border bg-card text-sm"
                  >
                    <option value="">{t('bulkSms.selectStaff')}</option>
                    {staffWithFormSlug.map((staff) => (
                      <option key={staff.id} value={staff.formSlug!}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Preview */}
              {message && activePreviewLead && (
                <div>
                  <label className="block text-sm font-medium mb-2">{t('bulkSms.preview')}</label>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">
                      {t('bulkSms.previewNote', { name: activePreviewLead.firstName })}
                    </p>
                    <p className="text-sm whitespace-pre-wrap break-words">{previewMessage}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        {sendState === 'idle' && (
          <div className="flex justify-end gap-3 p-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
            >
              {t('common.cancel')}
            </button>
            <button
              onClick={handleSend}
              disabled={!message.trim() || (formLinkType === 'staff' && !staffSlug) || activeLeadIds.length === 0 || activeLeadIds.length > maxRecipients}
              className={cn(
                'px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors',
                !message.trim() || (formLinkType === 'staff' && !staffSlug) || activeLeadIds.length === 0 || activeLeadIds.length > maxRecipients
                  ? 'bg-primary/50 cursor-not-allowed'
                  : 'bg-primary hover:bg-primary/90'
              )}
            >
              {t('bulkSms.sendButton', { count: targetCount })}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function getBulkSmsErrorMessage(error: unknown) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message
  return null
}
