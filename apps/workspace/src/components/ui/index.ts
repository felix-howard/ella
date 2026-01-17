/**
 * Shared UI components for workspace app
 * Exports verification, copy tracking, and progress components
 */

// Image viewer (PDF viewer is lazy loaded internally)
export { ImageViewer, type ImageViewerProps } from './image-viewer'

// Field verification
export {
  FieldVerificationItem,
  type FieldVerificationItemProps,
  type FieldVerificationStatus,
} from './field-verification-item'

// Copyable field (hook exported from hooks folder)
export { CopyableField, type CopyableFieldProps } from './copyable-field'

// Progress indicators
export {
  ProgressIndicator,
  CompactProgressIndicator,
  type ProgressIndicatorProps,
  type CompactProgressIndicatorProps,
} from './progress-indicator'

// Toast container (existing)
export { ToastContainer } from './toast-container'

// Re-export hook from hooks folder for convenience
export { useCopyTracking, type CopyProgress, type CopyTrackingReturn } from '../../hooks/use-copy-tracking'
