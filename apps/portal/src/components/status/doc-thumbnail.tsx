/**
 * Doc Thumbnail Component
 * Individual document item showing type, status, and optional reason
 * Used in status sections to display document information
 */
import { memo } from 'react'
import {
  FileText,
  CreditCard,
  Receipt,
  Briefcase,
  Home as HomeIcon,
  Baby,
  GraduationCap,
  Heart,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import type { Language } from '../../lib/i18n'
import type { ChecklistDoc } from '../../lib/api-client'

interface DocThumbnailProps {
  doc: ChecklistDoc
  variant: 'success' | 'warning' | 'error' | 'muted'
  language: Language
  showReason?: boolean
}

// Map doc types to icons
const DOC_ICONS: Record<string, React.ReactNode> = {
  W2: <Briefcase className="w-5 h-5" aria-hidden="true" />,
  SSN_CARD: <CreditCard className="w-5 h-5" aria-hidden="true" />,
  DRIVER_LICENSE: <CreditCard className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_INT: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_DIV: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_NEC: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_K: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_G: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1099_R: <Receipt className="w-5 h-5" aria-hidden="true" />,
  FORM_1098: <HomeIcon className="w-5 h-5" aria-hidden="true" />,
  FORM_1098_E: <GraduationCap className="w-5 h-5" aria-hidden="true" />,
  FORM_1098_T: <GraduationCap className="w-5 h-5" aria-hidden="true" />,
  FORM_5498: <Heart className="w-5 h-5" aria-hidden="true" />,
  BIRTH_CERTIFICATE: <Baby className="w-5 h-5" aria-hidden="true" />,
  DEPENDENT_SSN: <Baby className="w-5 h-5" aria-hidden="true" />,
  SPOUSE_SSN: <Heart className="w-5 h-5" aria-hidden="true" />,
  BUSINESS_LICENSE: <Building2 className="w-5 h-5" aria-hidden="true" />,
  SCHEDULE_C: <Building2 className="w-5 h-5" aria-hidden="true" />,
}

// Status icons
const STATUS_ICONS = {
  success: <CheckCircle2 className="w-4 h-4 text-primary" aria-hidden="true" />,
  warning: <AlertTriangle className="w-4 h-4 text-warning" aria-hidden="true" />,
  error: <Clock className="w-4 h-4 text-error" aria-hidden="true" />,
  muted: <Clock className="w-4 h-4 text-muted-foreground" aria-hidden="true" />,
}

export const DocThumbnail = memo(function DocThumbnail({
  doc,
  variant,
  language,
  showReason = false,
}: DocThumbnailProps) {
  const icon = DOC_ICONS[doc.docType] || <FileText className="w-5 h-5" aria-hidden="true" />

  const variantStyles = {
    success: {
      bg: 'bg-primary/5',
      iconBg: 'bg-primary/10 text-primary',
    },
    warning: {
      bg: 'bg-warning/5',
      iconBg: 'bg-warning/10 text-warning',
    },
    error: {
      bg: 'bg-error/5',
      iconBg: 'bg-error/10 text-error',
    },
    muted: {
      bg: 'bg-muted/30',
      iconBg: 'bg-muted text-muted-foreground',
    },
  }

  const styles = variantStyles[variant]

  // Get reason text based on language
  const getReasonText = (reason?: string) => {
    if (!reason) return null

    // Common reasons mapping
    const reasonMap: Record<string, { vi: string; en: string }> = {
      BLURRY: { vi: 'Ảnh bị mờ', en: 'Image is blurry' },
      INCOMPLETE: { vi: 'Thiếu thông tin', en: 'Incomplete information' },
      WRONG_DOC: { vi: 'Sai loại tài liệu', en: 'Wrong document type' },
      EXPIRED: { vi: 'Tài liệu hết hạn', en: 'Document expired' },
    }

    const mapped = reasonMap[reason]
    if (mapped) {
      return language === 'VI' ? mapped.vi : mapped.en
    }
    return reason
  }

  const docLabel = doc.labelVi || doc.docType.replace(/_/g, ' ')

  return (
    <div
      className={`flex items-start gap-3 p-3 rounded-xl ${styles.bg} mb-2 last:mb-0`}
      role="listitem"
      aria-label={docLabel}
    >
      {/* Icon */}
      <div className={`w-10 h-10 rounded-lg ${styles.iconBg} flex items-center justify-center shrink-0`}>
        {icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground truncate">
            {docLabel}
          </h4>
          {STATUS_ICONS[variant]}
        </div>

        {/* Doc type as subtitle if different from label */}
        <p className="text-xs text-muted-foreground mt-0.5">
          {doc.docType.replace(/_/g, '-')}
        </p>

        {/* Reason for warning/error */}
        {showReason && doc.reason && (
          <p className={`text-xs mt-1 ${
            variant === 'warning' ? 'text-warning' :
            variant === 'error' ? 'text-error' : 'text-muted-foreground'
          }`}>
            {getReasonText(doc.reason)}
          </p>
        )}
      </div>
    </div>
  )
})

export default DocThumbnail
