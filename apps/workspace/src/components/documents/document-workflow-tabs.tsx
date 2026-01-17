/**
 * DocumentWorkflowTabs - 3-tab workflow for document management
 * Tabs: Uploads | Review Queue | Verified
 * Replaces the confusing 4-card layout with clear workflow progression
 */

import { useState, useMemo } from 'react'
import { Upload, Search, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react'
import { Tabs, TabsList, TabsTrigger, TabsContent, Badge, Button } from '@ella/ui'
import { ErrorBoundary } from '../error-boundary'
import { UploadsTab } from './uploads-tab'
import { ReviewQueueTab } from './review-queue-tab'
import { VerifiedTab } from './verified-tab'
import type { RawImage, DigitalDoc } from '../../lib/api-client'

// Status arrays for filtering - defined outside component to prevent recreation
const UPLOAD_STATUSES = ['UPLOADED', 'PROCESSING', 'CLASSIFIED', 'UNCLASSIFIED', 'BLURRY']
const REVIEW_STATUSES = ['PENDING', 'EXTRACTED', 'PARTIAL']

export type WorkflowTab = 'uploads' | 'review' | 'verified'

export interface DocumentWorkflowTabsProps {
  caseId: string
  rawImages: RawImage[]
  digitalDocs: DigitalDoc[]
  /** Callback when image needs manual classification */
  onClassifyImage?: (image: RawImage) => void
  /** Callback when image needs classification review */
  onReviewClassification?: (image: RawImage) => void
  /** Callback when doc needs verification */
  onVerifyDoc?: (doc: DigitalDoc) => void
  /** Callback when doc is verified and ready for data entry */
  onDataEntry?: (doc: DigitalDoc) => void
}

/**
 * Main 3-tab workflow container for document management
 * - Uploads: Raw images awaiting processing/classification
 * - Review Queue: Docs extracted by AI, needing verification
 * - Verified: Completed docs ready for data entry to OltPro
 */
export function DocumentWorkflowTabs({
  caseId,
  rawImages,
  digitalDocs,
  onClassifyImage,
  onReviewClassification,
  onVerifyDoc,
  onDataEntry,
}: DocumentWorkflowTabsProps) {
  const [activeTab, setActiveTab] = useState<WorkflowTab>('uploads')

  // Memoized counts for badge display - prevents recalculation on every render
  const { uploadsCount, reviewCount, verifiedCount } = useMemo(() => {
    // Uploads: images not yet linked to digital docs
    const uploads = rawImages.filter((img) => UPLOAD_STATUSES.includes(img.status)).length

    // Review: docs needing verification (extracted but not verified)
    const review = digitalDocs.filter((doc) => REVIEW_STATUSES.includes(doc.status)).length

    // Verified: docs that have been verified
    const verified = digitalDocs.filter((doc) => doc.status === 'VERIFIED').length

    return { uploadsCount: uploads, reviewCount: review, verifiedCount: verified }
  }, [rawImages, digitalDocs])

  return (
    <Tabs
      defaultValue="uploads"
      value={activeTab}
      onValueChange={(val) => setActiveTab(val as WorkflowTab)}
      variant="pill"
      className="w-full"
    >
      <TabsList className="grid w-full grid-cols-3 bg-muted rounded-xl p-1.5">
        <TabsTrigger value="uploads" className="flex items-center gap-2 rounded-lg">
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Tải lên</span>
          {uploadsCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {uploadsCount}
            </Badge>
          )}
        </TabsTrigger>

        <TabsTrigger value="review" className="flex items-center gap-2 rounded-lg">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Cần xác minh</span>
          {reviewCount > 0 && (
            <Badge variant="warning" className="ml-1 px-1.5 py-0.5 text-xs">
              {reviewCount}
            </Badge>
          )}
        </TabsTrigger>

        <TabsTrigger value="verified" className="flex items-center gap-2 rounded-lg">
          <CheckCircle className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Đã xác minh</span>
          {verifiedCount > 0 && (
            <Badge variant="success" className="ml-1 px-1.5 py-0.5 text-xs">
              {verifiedCount}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="uploads" className="mt-4">
        <ErrorBoundary fallback={<TabErrorFallback tabName="Tải lên" />}>
          <UploadsTab
            caseId={caseId}
            images={rawImages}
            onClassify={onClassifyImage}
            onReviewClassification={onReviewClassification}
          />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="review" className="mt-4">
        <ErrorBoundary fallback={<TabErrorFallback tabName="Xác minh" />}>
          <ReviewQueueTab
            caseId={caseId}
            docs={digitalDocs}
            onVerify={onVerifyDoc}
          />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value="verified" className="mt-4">
        <ErrorBoundary fallback={<TabErrorFallback tabName="Đã xác minh" />}>
          <VerifiedTab
            caseId={caseId}
            docs={digitalDocs}
            onDataEntry={onDataEntry}
          />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  )
}

/**
 * Error fallback UI for tab content
 * Displays when a tab component throws an error
 */
function TabErrorFallback({ tabName }: { tabName: string }) {
  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-12 h-12 rounded-full bg-error-light flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6 text-error" aria-hidden="true" />
      </div>
      <h3 className="text-base font-medium text-foreground mb-2">
        Lỗi khi tải tab {tabName}
      </h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-xs">
        Đã xảy ra lỗi không mong muốn. Vui lòng thử lại.
      </p>
      <Button variant="outline" size="sm" onClick={handleRefresh} className="gap-2">
        <RefreshCw className="w-4 h-4" aria-hidden="true" />
        Tải lại trang
      </Button>
    </div>
  )
}
