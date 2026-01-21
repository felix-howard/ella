/**
 * Documents components barrel export
 */

// Classification modals
export { ManualClassificationModal } from './manual-classification-modal'
export { UploadProgress } from './upload-progress'

// Verification Modal (Phase 05)
export { VerificationModal, type VerificationModalProps } from './verification-modal'

// Data Entry Modal (Phase 06)
export { DataEntryModal, type DataEntryModalProps } from './data-entry-modal'
export { ReUploadRequestModal, type ReUploadRequestModalProps } from './reupload-request-modal'

// Document Tab UX Redesign components
export { UnclassifiedDocsCard, type UnclassifiedDocsCardProps } from './unclassified-docs-card'
export { DuplicateDocsCard, type DuplicateDocsCardProps } from './duplicate-docs-card'
export { DataEntryTab, DataEntryTabSkeleton, type DataEntryTabProps } from './data-entry-tab'

// Note: PdfThumbnail is lazy-loaded internally and should not be exported directly
// to ensure proper code-splitting of the react-pdf library (~150KB)
