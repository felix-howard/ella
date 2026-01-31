/**
 * DataEntryTab - Clean card layout for verified docs data entry
 * Shows verified docs grouped by category with icons
 * Features: responsive grid, clean card design, category icons
 */

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Eye,
  CheckCircle,
  User,
  DollarSign,
  Receipt,
  Briefcase,
  FileQuestion
} from 'lucide-react'
import { cn } from '@ella/ui'
import { DOC_TYPE_LABELS, DOC_TYPE_CATEGORIES } from '../../lib/constants'
import { DataEntryModal } from './data-entry-modal'
import { ErrorBoundary } from '../error-boundary'
import type { DigitalDoc } from '../../lib/api-client'

export interface DataEntryTabProps {
  /** All documents for the case */
  docs: DigitalDoc[]
  /** Case ID for modal operations */
  caseId: string
  /** Loading state */
  isLoading?: boolean
}

/** Category icons mapping */
const CATEGORY_ICONS: Record<string, typeof User> = {
  personal: User,
  income: DollarSign,
  deductions: Receipt,
  business: Briefcase,
  other: FileQuestion,
}

/** Category group type */
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

export function DataEntryTab({ docs, caseId, isLoading }: DataEntryTabProps) {
  const { t } = useTranslation()
  const [selectedDoc, setSelectedDoc] = useState<DigitalDoc | null>(null)

  // Filter to verified docs only and group by category
  const verifiedDocs = useMemo(() => docs.filter((d) => d.status === 'VERIFIED'), [docs])
  const grouped = useMemo(() => groupDocsByCategory(verifiedDocs), [verifiedDocs])

  if (isLoading) {
    return <DataEntryTabSkeleton />
  }

  if (verifiedDocs.length === 0) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" aria-hidden="true" />
        <h3 className="text-base font-medium text-foreground mb-2">{t('dataEntry.noDocuments')}</h3>
        <p className="text-sm text-muted-foreground">
          {t('dataEntry.noDocumentsDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Category sections */}
      {grouped.map(({ key, label, docs: categoryDocs }) => {
        const CategoryIcon = CATEGORY_ICONS[key] || FileQuestion
        return (
          <section key={key}>
            {/* Category header with icon */}
            <div className="flex items-center gap-2.5 mb-4">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <CategoryIcon className="w-5 h-5 text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">{label}</h2>
              <span className="text-sm text-muted-foreground">({categoryDocs.length})</span>
            </div>

            {/* Docs grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {categoryDocs.map((doc) => (
                <DocCard key={doc.id} doc={doc} onView={() => setSelectedDoc(doc)} />
              ))}
            </div>
          </section>
        )
      })}

      {/* Data Entry Modal */}
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
  const { t } = useTranslation()
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-card rounded-lg p-6 max-w-sm text-center">
        <p className="text-foreground mb-4">{t('dataEntry.errorDisplay')}</p>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-muted rounded-lg text-sm font-medium hover:bg-muted/80 transition-colors"
        >
          {t('dataEntry.close')}
        </button>
      </div>
    </div>
  )
}

/** Single document card - clean, clickable design */
interface DocCardProps {
  doc: DigitalDoc
  onView: () => void
}

function DocCard({ doc, onView }: DocCardProps) {
  const { t } = useTranslation()
  const docLabel = DOC_TYPE_LABELS[doc.docType] || doc.docType

  return (
    <button
      onClick={onView}
      className={cn(
        'group relative w-full text-left',
        'bg-card border border-border rounded-xl p-4',
        'hover:border-primary/50 hover:shadow-sm',
        'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
        'transition-all duration-150'
      )}
    >
      {/* Verified badge */}
      <div className="absolute top-2 right-2">
        <CheckCircle className="w-4 h-4 text-success" aria-hidden="true" />
      </div>

      {/* Doc name */}
      <div className="pr-6">
        <h4 className="font-medium text-sm text-foreground leading-snug line-clamp-2">
          {docLabel}
        </h4>
      </div>

      {/* View indicator on hover */}
      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground group-hover:text-primary transition-colors">
        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
        <span>{t('dataEntry.viewDetails')}</span>
      </div>
    </button>
  )
}

/** Skeleton loader */
export function DataEntryTabSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((section) => (
        <div key={section}>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-muted rounded-lg animate-pulse" />
            <div className="h-6 w-32 bg-muted rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {[1, 2, 3, 4].map((card) => (
              <div key={card} className="bg-card border rounded-xl p-4">
                <div className="h-4 w-4 bg-muted rounded-full animate-pulse absolute top-2 right-2" />
                <div className="h-4 w-3/4 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
                <div className="mt-3 h-3 w-20 bg-muted rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
