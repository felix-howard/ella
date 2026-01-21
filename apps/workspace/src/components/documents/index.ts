/**
 * Documents components barrel export
 */

// Legacy components (VerificationPanel deprecated in favor of DocumentWorkflowTabs)
export { VerificationPanel } from './verification-panel'
export { ClassificationReviewModal } from './classification-review-modal'
export { ManualClassificationModal } from './manual-classification-modal'
export { UploadProgress } from './upload-progress'

// New 3-tab workflow components (Phase 04)
export { DocumentWorkflowTabs, type DocumentWorkflowTabsProps, type WorkflowTab } from './document-workflow-tabs'
export { UploadsTab, UploadsTabSkeleton, type UploadsTabProps } from './uploads-tab'
export { ReviewQueueTab, ReviewQueueSkeleton, type ReviewQueueTabProps } from './review-queue-tab'
export { VerifiedTab, VerifiedTabSkeleton, type VerifiedTabProps } from './verified-tab'

// Verification Modal (Phase 05)
export { VerificationModal, type VerificationModalProps } from './verification-modal'

// Data Entry and Re-upload Modals (Phase 06)
export { DataEntryModal, type DataEntryModalProps } from './data-entry-modal'
export { ReUploadRequestModal, type ReUploadRequestModalProps } from './reupload-request-modal'

// Unclassified Docs Card (Phase: Document Tab UX Redesign)
export { UnclassifiedDocsCard, type UnclassifiedDocsCardProps } from './unclassified-docs-card'

// Note: PdfThumbnail is lazy-loaded internally and should not be exported directly
// to ensure proper code-splitting of the react-pdf library (~150KB)
