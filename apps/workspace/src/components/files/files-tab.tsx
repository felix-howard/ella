/**
 * FilesTab - Main container for document file explorer view
 * Shows all documents grouped by AI-classified category
 */

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { api, type RawImage, type DigitalDoc } from '../../lib/api-client'
import { DOC_CATEGORIES, getCategoryForDocType, type DocCategoryKey } from '../../lib/doc-categories'
import { UnclassifiedSection } from './unclassified-section'
import { FileCategorySection } from './file-category-section'
import { ManualClassificationModal, VerificationModal } from '../documents'

export interface FilesTabProps {
  caseId: string
}

/**
 * Files Tab - Document explorer view showing all uploaded files
 * Grouped by AI classification category, unclassified at top
 */
export function FilesTab({ caseId }: FilesTabProps) {
  const [classifyImage, setClassifyImage] = useState<RawImage | null>(null)
  const [isClassifyModalOpen, setIsClassifyModalOpen] = useState(false)
  const [verifyDoc, setVerifyDoc] = useState<DigitalDoc | null>(null)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)

  // Fetch all raw images for case
  const { data: imagesData, isLoading: imagesLoading } = useQuery({
    queryKey: ['images', caseId],
    queryFn: () => api.cases.getImages(caseId),
  })

  // Fetch digital docs for verification status
  const { data: docsData } = useQuery({
    queryKey: ['docs', caseId],
    queryFn: () => api.cases.getDocs(caseId),
  })

  const docs = docsData?.docs ?? []

  // Memoize images array to maintain stable reference
  const images = useMemo(() => imagesData?.images ?? [], [imagesData?.images])

  // Group images by category
  const { unclassified, categorized } = useMemo(() => {
    const unclassified: RawImage[] = []
    const byCategory: Record<DocCategoryKey, RawImage[]> = {
      personal: [],
      employment_income: [],
      self_employment: [],
      investment_income: [],
      retirement: [],
      deductions: [],
      business: [],
      other: [],
    }

    for (const img of images) {
      // Unclassified: UPLOADED, UNCLASSIFIED, or CLASSIFIED but not linked to checklist
      if (
        !img.classifiedType ||
        img.status === 'UNCLASSIFIED' ||
        img.status === 'UPLOADED' ||
        (img.status === 'CLASSIFIED' && !img.checklistItem)
      ) {
        unclassified.push(img)
      } else {
        const category = getCategoryForDocType(img.classifiedType)
        byCategory[category].push(img)
      }
    }

    return { unclassified, categorized: byCategory }
  }, [images])

  // Handlers
  const handleClassify = (image: RawImage) => {
    setClassifyImage(image)
    setIsClassifyModalOpen(true)
  }

  const handleCloseClassifyModal = () => {
    setIsClassifyModalOpen(false)
    setTimeout(() => setClassifyImage(null), 200)
  }

  const handleVerify = (doc: DigitalDoc) => {
    setVerifyDoc(doc)
    setIsVerifyModalOpen(true)
  }

  const handleCloseVerifyModal = () => {
    setIsVerifyModalOpen(false)
    setTimeout(() => setVerifyDoc(null), 200)
  }

  // Loading state with skeleton
  if (imagesLoading) {
    return <FilesTabSkeleton />
  }

  // Empty state
  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Chưa có tài liệu nào</p>
        <p className="text-sm text-muted-foreground mt-1">
          Khách hàng chưa gửi tài liệu qua portal hoặc tin nhắn
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Unclassified Section - Always at top */}
      <UnclassifiedSection images={unclassified} onClassify={handleClassify} />

      {/* Categorized Sections */}
      {(Object.keys(DOC_CATEGORIES) as DocCategoryKey[]).map((categoryKey) => {
        const config = DOC_CATEGORIES[categoryKey]
        const categoryImages = categorized[categoryKey]

        if (categoryImages.length === 0) return null

        return (
          <FileCategorySection
            key={categoryKey}
            categoryKey={categoryKey}
            label={config.labelVi}
            Icon={config.icon}
            images={categoryImages}
            docs={docs}
            onVerify={handleVerify}
          />
        )
      })}

      {/* Classification Modal */}
      <ManualClassificationModal
        image={classifyImage}
        isOpen={isClassifyModalOpen}
        onClose={handleCloseClassifyModal}
        caseId={caseId}
      />

      {/* Verification Modal */}
      {verifyDoc && (
        <VerificationModal
          doc={verifyDoc}
          isOpen={isVerifyModalOpen}
          onClose={handleCloseVerifyModal}
          caseId={caseId}
        />
      )}
    </div>
  )
}

/**
 * Loading skeleton for Files Tab
 */
export function FilesTabSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Unclassified section skeleton */}
      <div className="bg-muted/30 border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 rounded bg-muted" />
          <div className="w-24 h-4 rounded bg-muted" />
          <div className="w-6 h-4 rounded-full bg-muted" />
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="aspect-square rounded-lg bg-muted" />
          ))}
        </div>
      </div>

      {/* Category section skeletons */}
      {[1, 2].map((i) => (
        <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-4 h-4 rounded bg-muted" />
              <div className="w-5 h-5 rounded bg-muted" />
              <div className="w-32 h-4 rounded bg-muted" />
              <div className="w-12 h-4 rounded bg-muted" />
            </div>
            <div className="w-4 h-4 rounded bg-muted" />
          </div>
          <div className="border-t border-border divide-y divide-border">
            {[1, 2].map((j) => (
              <div key={j} className="flex items-center gap-4 p-3">
                <div className="w-12 h-12 rounded-lg bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="w-32 h-4 rounded bg-muted" />
                  <div className="w-24 h-3 rounded bg-muted" />
                </div>
                <div className="w-20 h-4 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
