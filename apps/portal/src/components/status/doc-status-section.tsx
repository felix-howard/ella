/**
 * Doc Status Section Component
 * Collapsible section showing documents in a specific status
 * Shows received, blurry, or other status documents
 */
import { memo, useState } from 'react'
import { ChevronDown, CheckCircle2, AlertTriangle, Upload } from 'lucide-react'
import { Button } from '@ella/ui'
import { DocThumbnail } from './doc-thumbnail'
import { getText, type Language } from '../../lib/i18n'
import type { ChecklistDoc } from '../../lib/api-client'

interface DocStatusSectionProps {
  title: string
  docs: ChecklistDoc[]
  variant: 'success' | 'warning' | 'error' | 'muted'
  language: Language
  defaultExpanded?: boolean
  showReason?: boolean
  onUploadClick?: () => void
}

export const DocStatusSection = memo(function DocStatusSection({
  title,
  docs,
  variant,
  language,
  defaultExpanded = false,
  showReason = false,
  onUploadClick,
}: DocStatusSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const t = getText(language)
  const sectionId = `doc-section-${variant}`

  const variantStyles = {
    success: {
      headerBg: 'bg-primary/5',
      border: 'border-primary/20',
      icon: <CheckCircle2 className="w-5 h-5 text-primary" aria-hidden="true" />,
      iconBg: 'bg-primary/10',
    },
    warning: {
      headerBg: 'bg-warning/5',
      border: 'border-warning/20',
      icon: <AlertTriangle className="w-5 h-5 text-warning" aria-hidden="true" />,
      iconBg: 'bg-warning/10',
    },
    error: {
      headerBg: 'bg-error/5',
      border: 'border-error/20',
      icon: <AlertTriangle className="w-5 h-5 text-error" aria-hidden="true" />,
      iconBg: 'bg-error/10',
    },
    muted: {
      headerBg: 'bg-muted/50',
      border: 'border-border',
      icon: null,
      iconBg: 'bg-muted',
    },
  }

  const styles = variantStyles[variant]

  return (
    <div className={`rounded-2xl border ${styles.border} overflow-hidden`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center gap-3 p-4 ${styles.headerBg} transition-colors touch-manipulation`}
        aria-expanded={isExpanded}
        aria-controls={sectionId}
      >
        {/* Icon */}
        {styles.icon && (
          <div className={`w-10 h-10 rounded-full ${styles.iconBg} flex items-center justify-center shrink-0`}>
            {styles.icon}
          </div>
        )}

        {/* Title and count */}
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <p className="text-sm text-muted-foreground">
            {docs.length} {docs.length === 1
              ? (language === 'VI' ? 'tài liệu' : 'document')
              : (language === 'VI' ? 'tài liệu' : 'documents')}
          </p>
        </div>

        {/* Expand icon */}
        <ChevronDown
          className={`w-5 h-5 text-muted-foreground transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Content */}
      {isExpanded && (
        <div
          id={sectionId}
          className="p-4 pt-0 space-y-3 animate-in slide-in-from-top-2 duration-200"
          role="region"
          aria-label={`${title} documents list`}
        >
          <div className="border-t border-border pt-4" role="list">
            {docs.map((doc) => (
              <DocThumbnail
                key={doc.id}
                doc={doc}
                variant={variant}
                language={language}
                showReason={showReason}
              />
            ))}
          </div>

          {/* Upload CTA for warning/error sections */}
          {(variant === 'warning' || variant === 'error') && onUploadClick && (
            <Button
              variant="outline"
              className="w-full h-12 rounded-xl gap-2"
              onClick={onUploadClick}
            >
              <Upload className="w-4 h-4" aria-hidden="true" />
              {variant === 'warning'
                ? (language === 'VI' ? 'Gửi lại ảnh' : 'Resend Photos')
                : t.uploadDocs}
            </Button>
          )}
        </div>
      )}
    </div>
  )
})

export default DocStatusSection
