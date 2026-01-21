/**
 * DataEntryTab - Responsive grid layout for verified docs data entry
 * Shows verified docs grouped by category with copyable fields for OltPro
 * Features: responsive 4/3/2 col grid, copy all fields, view detail modal
 */

import { useMemo, useState } from 'react'
import { Copy, Eye, CheckCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { DOC_TYPE_LABELS, DOC_TYPE_CATEGORIES } from '../../lib/constants'
import { getFieldLabelForDocType, isExcludedField } from '../../lib/field-labels'
import { useClipboard } from '../../hooks/use-clipboard'
import { DataEntryModal } from './data-entry-modal'
import { ErrorBoundary } from '../error-boundary'
import type { DigitalDoc } from '../../lib/api-client'

/** Escape HTML entities for safe title attribute display */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Type guard for extracted data validation */
function isValidExtractedData(data: unknown): data is Record<string, unknown> {
  return typeof data === 'object' && data !== null && !Array.isArray(data)
}

export interface DataEntryTabProps {
  /** All documents for the case */
  docs: DigitalDoc[]
  /** Case ID for modal operations */
  caseId: string
  /** Loading state */
  isLoading?: boolean
}

/** Key fields to display per doc type (most important 2-3 fields) */
const KEY_FIELDS: Record<string, string[]> = {
  W2: ['wages', 'federalWithholding'],
  FORM_1099_INT: ['interestIncome'],
  FORM_1099_DIV: ['ordinaryDividends', 'qualifiedDividends'],
  FORM_1099_NEC: ['nonemployeeCompensation'],
  FORM_1099_MISC: ['otherIncome', 'rents'],
  FORM_1099_K: ['grossAmount'],
  FORM_1099_R: ['grossDistribution', 'taxableAmount'],
  FORM_1099_G: ['unemploymentCompensation', 'stateLocalRefund'],
  FORM_1099_SSA: ['netBenefits', 'federalWithholding'],
  FORM_1098: ['mortgageInterest', 'realEstateTax'],
  FORM_1098_T: ['tuitionPaid', 'scholarships'],
  DAYCARE_RECEIPT: ['total', 'vendor'],
  RECEIPT: ['amount', 'vendor'],
}

/** Category grouping type */
interface CategoryGroup {
  key: string
  label: string
  docs: DigitalDoc[]
}

/**
 * Group verified docs by category
 */
function groupDocsByCategory(docs: DigitalDoc[]): CategoryGroup[] {
  const groups: CategoryGroup[] = []

  for (const [key, { label, docTypes }] of Object.entries(DOC_TYPE_CATEGORIES)) {
    const categoryDocs = docs.filter((d) => docTypes.includes(d.docType))
    if (categoryDocs.length > 0) {
      groups.push({ key, label, docs: categoryDocs })
    }
  }

  return groups
}

/**
 * Get key field values for display in card
 */
function getKeyFieldValues(
  docType: string,
  extractedData: unknown
): Array<{ label: string; value: string }> {
  if (!isValidExtractedData(extractedData)) return []

  const fieldKeys = KEY_FIELDS[docType] || []
  const result: Array<{ label: string; value: string }> = []

  for (const key of fieldKeys) {
    const value = extractedData[key]
    if (value !== undefined && value !== null && value !== '') {
      result.push({
        label: getFieldLabelForDocType(key, docType),
        value: formatValue(value),
      })
    }
  }

  // If no key fields found, show first 2 non-excluded fields
  if (result.length === 0) {
    const entries = Object.entries(extractedData)
    for (const [key, value] of entries) {
      if (!isExcludedField(key) && value !== undefined && value !== null && value !== '') {
        result.push({
          label: getFieldLabelForDocType(key, docType),
          value: formatValue(value),
        })
        if (result.length >= 2) break
      }
    }
  }

  return result.slice(0, 3)
}

/**
 * Format value for display (handle numbers, dates, etc.)
 */
function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    // Format currency-like numbers
    if (value >= 100 || value % 1 !== 0) {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value)
    }
    return String(value)
  }
  return String(value)
}

/**
 * Format all extracted data for clipboard copy
 */
function formatForCopy(doc: DigitalDoc): string {
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

  if (!isValidExtractedData(doc.extractedData)) return docLabel
  const extractedData = doc.extractedData

  const lines = Object.entries(extractedData)
    .filter(([key, value]) => !isExcludedField(key) && value !== null && value !== undefined && value !== '')
    .map(([key, value]) => `${getFieldLabelForDocType(key, doc.docType)}: ${value}`)

  return `${docLabel}\n${lines.join('\n')}`
}

export function DataEntryTab({ docs, caseId, isLoading }: DataEntryTabProps) {
  const [selectedDoc, setSelectedDoc] = useState<DigitalDoc | null>(null)

  // Filter to verified docs only and group by category
  const verifiedDocs = useMemo(() => docs.filter((d) => d.status === 'VERIFIED'), [docs])
  const grouped = useMemo(() => groupDocsByCategory(verifiedDocs), [verifiedDocs])

  if (isLoading) {
    return <DataEntryTabSkeleton />
  }

  if (verifiedDocs.length === 0) {
    return (
      <div className="text-center py-12">
        <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
        <h3 className="text-base font-medium text-foreground mb-2">Chưa có tài liệu đã xác minh</h3>
        <p className="text-sm text-muted-foreground">
          Các tài liệu sau khi xác minh sẽ xuất hiện ở đây để nhập liệu
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{verifiedDocs.length} tài liệu đã xác minh</p>
      </div>

      {/* Category sections with responsive grid */}
      {grouped.map(({ key, label, docs: categoryDocs }) => (
        <section key={key}>
          <h3 className="text-sm font-semibold text-foreground mb-3 border-b border-border pb-2">{label}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {categoryDocs.map((doc) => (
              <DocCard key={doc.id} doc={doc} onView={() => setSelectedDoc(doc)} />
            ))}
          </div>
        </section>
      ))}

      {/* Data Entry Modal - wrapped in ErrorBoundary */}
      {selectedDoc && (
        <ErrorBoundary fallback={<ModalErrorFallback onClose={() => setSelectedDoc(null)} />}>
          <DataEntryModal
            doc={selectedDoc}
            isOpen={!!selectedDoc}
            onClose={() => setSelectedDoc(null)}
            caseId={caseId}
          />
        </ErrorBoundary>
      )}
    </div>
  )
}

/** Fallback UI when modal crashes */
function ModalErrorFallback({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg p-6 max-w-sm text-center">
        <p className="text-foreground mb-4">Không thể hiển thị chi tiết. Vui lòng thử lại.</p>
        <Button onClick={onClose} variant="outline">Đóng</Button>
      </div>
    </div>
  )
}

/** Single document card component */
interface DocCardProps {
  doc: DigitalDoc
  onView: () => void
}

function DocCard({ doc, onView }: DocCardProps) {
  const { copy } = useClipboard({ successMessage: 'Đã sao chép!' })
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType
  const keyFields = getKeyFieldValues(doc.docType, doc.extractedData)

  const handleCopy = () => {
    copy(formatForCopy(doc))
  }

  return (
    <div className="bg-card border rounded-lg p-3 hover:border-primary/50 transition-colors">
      <h4 className="font-medium text-sm text-foreground mb-2 truncate" title={escapeHtml(docLabel)}>
        {docLabel}
      </h4>

      {/* Key field values */}
      <div className="space-y-1 text-xs text-muted-foreground mb-3 min-h-[40px]">
        {keyFields.length > 0 ? (
          keyFields.map(({ label, value }) => (
            <div key={label} className="truncate" title={escapeHtml(`${label}: ${value}`)}>
              <span className="text-muted-foreground/70">{label}:</span> {value}
            </div>
          ))
        ) : (
          <div className="text-muted-foreground/50 italic">Không có dữ liệu</div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={handleCopy} className="flex-1 text-xs">
          <Copy className="w-3 h-3 mr-1" />
          Copy
        </Button>
        <Button size="sm" variant="ghost" onClick={onView} className="text-xs">
          <Eye className="w-3 h-3 mr-1" />
          Xem
        </Button>
      </div>
    </div>
  )
}

/** Skeleton loader */
export function DataEntryTabSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-5 w-40 bg-muted rounded animate-pulse" />
      {[1, 2].map((section) => (
        <div key={section}>
          <div className="h-4 w-24 bg-muted rounded animate-pulse mb-3" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="bg-card border rounded-lg p-3">
                <div className="h-4 w-20 bg-muted rounded animate-pulse mb-2" />
                <div className="space-y-1 mb-3">
                  <div className="h-3 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-3/4 bg-muted rounded animate-pulse" />
                </div>
                <div className="flex gap-2">
                  <div className="h-7 flex-1 bg-muted rounded animate-pulse" />
                  <div className="h-7 w-14 bg-muted rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
