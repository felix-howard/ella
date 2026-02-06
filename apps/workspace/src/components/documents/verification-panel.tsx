/**
 * Verification Panel Component - Lists pending documents for verification
 * Allows staff to verify or reject documents with optional notes
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, X, FileText, AlertCircle, Loader2 } from 'lucide-react'
import { cn } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { DOC_TYPE_LABELS } from '../../lib/constants'
import { api, type DigitalDoc } from '../../lib/api-client'

interface VerificationPanelProps {
  documents: DigitalDoc[]
  onRefresh: () => void
}

export function VerificationPanel({ documents, onRefresh }: VerificationPanelProps) {
  const { t } = useTranslation()
  // Filter to pending/extracted documents that need verification
  const pendingDocs = documents.filter(
    (d) => d.status === 'PENDING' || d.status === 'EXTRACTED' || d.status === 'PARTIAL'
  )

  if (pendingDocs.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Check className="w-8 h-8 mx-auto mb-2 text-success" />
        <p>{t('verificationPanel.allVerified')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="font-medium">{t('verificationPanel.needsVerification')} ({pendingDocs.length})</h3>

      {pendingDocs.map((doc) => (
        <DocumentVerificationCard
          key={doc.id}
          document={doc}
          onVerified={onRefresh}
        />
      ))}
    </div>
  )
}

interface DocumentVerificationCardProps {
  document: DigitalDoc
  onVerified: () => void
}

function DocumentVerificationCard({ document, onVerified }: DocumentVerificationCardProps) {
  const { t } = useTranslation()
  const [isVerifying, setIsVerifying] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectReason, setRejectReason] = useState('')

  const handleVerify = async () => {
    setIsVerifying(true)
    try {
      await api.docs.verifyAction(document.id, { action: 'verify' })
      toast.success(t('verificationPanel.verifySuccess'))
      onVerified()
    } catch {
      toast.error(t('verificationPanel.verifyError'))
    } finally {
      setIsVerifying(false)
    }
  }

  const handleReject = async () => {
    setIsVerifying(true)
    try {
      await api.docs.verifyAction(document.id, {
        action: 'reject',
        notes: rejectReason || undefined,
      })
      toast.success(t('verificationPanel.rejectSuccess'))
      onVerified()
    } catch {
      toast.error(t('verificationPanel.rejectError'))
    } finally {
      setIsVerifying(false)
      setShowRejectForm(false)
      setRejectReason('')
    }
  }

  // Get confidence as percentage
  const confidencePercent = document.extractedData
    ? Math.round((document.extractedData as { aiConfidence?: number }).aiConfidence ?? 0)
    : 0

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground truncate">
              {DOC_TYPE_LABELS[document.docType] || document.docType}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {document.rawImage?.filename || 'No filename'}
            </p>
            {/* Status and confidence badges */}
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  'text-xs font-medium px-2 py-0.5 rounded-full',
                  document.status === 'EXTRACTED' && 'bg-primary-light text-primary',
                  document.status === 'PENDING' && 'bg-warning-light text-warning',
                  document.status === 'PARTIAL' && 'bg-accent-light text-accent'
                )}
              >
                {document.status === 'EXTRACTED' && t('verificationPanel.extracted')}
                {document.status === 'PENDING' && t('verificationPanel.pending')}
                {document.status === 'PARTIAL' && t('verificationPanel.partial')}
              </span>
              {confidencePercent > 0 && (
                <span className="text-xs text-muted-foreground">
                  AI: {confidencePercent}%
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        {!showRejectForm && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleVerify}
              disabled={isVerifying}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-success text-white hover:bg-success/90 disabled:opacity-50'
              )}
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              {t('verificationPanel.verify')}
            </button>
            <button
              onClick={() => setShowRejectForm(true)}
              disabled={isVerifying}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50'
              )}
            >
              <X className="w-4 h-4" />
              {t('verificationPanel.reject')}
            </button>
          </div>
        )}
      </div>

      {/* Extracted data preview (simplified) */}
      {document.extractedData && Object.keys(document.extractedData).length > 0 && (
        <div className="mt-4 bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t('verificationPanel.extractedData')}</p>
          <div className="text-xs text-foreground space-y-1 max-h-32 overflow-auto">
            {Object.entries(document.extractedData)
              .filter(([key]) => !['aiConfidence', 'rawText'].includes(key))
              .slice(0, 5)
              .map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{key}:</span>
                  <span className="font-mono truncate">{String(value)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Reject reason form */}
      {showRejectForm && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-warning mt-0.5" />
            <p className="text-sm text-muted-foreground">
              {t('verificationPanel.rejectNote')}
            </p>
          </div>
          <input
            type="text"
            placeholder={t('verificationPanel.rejectReasonPlaceholder')}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleReject}
              disabled={isVerifying}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                'bg-destructive text-white hover:bg-destructive/90 disabled:opacity-50'
              )}
            >
              {isVerifying ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <X className="w-4 h-4" />
              )}
              {t('verificationPanel.confirmReject')}
            </button>
            <button
              onClick={() => {
                setShowRejectForm(false)
                setRejectReason('')
              }}
              disabled={isVerifying}
              className="px-3 py-2 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
