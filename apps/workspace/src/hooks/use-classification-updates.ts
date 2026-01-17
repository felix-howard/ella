/**
 * Classification Updates Hook - Polls for image status changes
 * Shows toast notifications when classification completes
 * Invalidates checklist query when images are linked
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type RawImage, type DigitalDoc } from '../lib/api-client'
import { toast } from '../stores/toast-store'
import { DOC_TYPE_LABELS } from '../lib/constants'

interface UseClassificationUpdatesOptions {
  caseId: string | undefined
  enabled?: boolean
  refetchInterval?: number
}

// Track previous image states for comparison
type ImageStatusMap = Map<string, { status: string; aiConfidence: number | null }>

// Track previous doc states for OCR extraction notifications
type DocStatusMap = Map<string, { status: string; docType: string }>

export function useClassificationUpdates({
  caseId,
  enabled = true,
  refetchInterval = 5000, // 5 seconds default
}: UseClassificationUpdatesOptions) {
  const queryClient = useQueryClient()
  const previousImagesRef = useRef<ImageStatusMap>(new Map())
  const previousDocsRef = useRef<DocStatusMap>(new Map())
  const isInitialLoadRef = useRef(true)
  const isInitialDocsLoadRef = useRef(true)
  // Track IDs that were already processing on initial load (old/stuck data)
  // These should be excluded from the progress notification
  const initialProcessingIdsRef = useRef<Set<string> | null>(null)
  const initialPendingDocIdsRef = useRef<Set<string> | null>(null)
  // Store computed counts in state (updated in effects to satisfy lint rules)
  const [activeProcessingCount, setActiveProcessingCount] = useState(0)
  const [activeExtractingCount, setActiveExtractingCount] = useState(0)

  const { data: imagesResponse } = useQuery({
    queryKey: ['images', caseId],
    queryFn: () => api.cases.getImages(caseId!),
    enabled: !!caseId && enabled,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false, // Only poll when tab active
  })

  // Docs query with polling (same interval as images)
  const { data: docsResponse } = useQuery({
    queryKey: ['docs', caseId],
    queryFn: () => api.cases.getDocs(caseId!),
    enabled: !!caseId && enabled,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false,
  })

  /**
   * Handle image status transition notifications
   * Shows toast with appropriate message based on status and confidence
   */
  const handleStatusChange = useCallback((prevStatus: string | null, current: RawImage) => {
    // Only notify for transitions from UPLOADED or PROCESSING
    if (prevStatus !== 'UPLOADED' && prevStatus !== 'PROCESSING') return

    const docLabel = current.classifiedType
      ? DOC_TYPE_LABELS[current.classifiedType] || current.classifiedType
      : 'Tài liệu'

    switch (current.status) {
      case 'CLASSIFIED': {
        const confidence = Math.round((current.aiConfidence || 0) * 100)
        if (current.aiConfidence && current.aiConfidence >= 0.85) {
          toast.success(`${docLabel} (${confidence}%)`)
        } else if (current.aiConfidence && current.aiConfidence >= 0.60) {
          toast.info(`Cần xác minh: ${docLabel} (${confidence}%)`)
        } else {
          toast.info(`Độ tin cậy thấp: ${docLabel}`)
        }
        // Refresh checklist for potential status updates
        queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
        break
      }

      case 'LINKED':
        toast.success(`Đã liên kết: ${docLabel}`)
        queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
        break

      case 'UNCLASSIFIED':
        // Check if confidence is 0 (AI service likely unavailable or failed)
        if (!current.aiConfidence || current.aiConfidence === 0) {
          toast.error(`AI thất bại: ${current.filename}. Vui lòng phân loại thủ công.`)
        } else {
          toast.info(`Cần xem xét: ${current.filename}`)
        }
        break

      case 'BLURRY':
        toast.error(`Ảnh mờ: ${current.filename}`)
        break
    }
  }, [caseId, queryClient])

  /**
   * Handle doc OCR status transition notifications
   * Shows toast when OCR extraction completes or fails
   */
  const handleDocStatusChange = useCallback((prevStatus: string | null, current: DigitalDoc) => {
    const docLabel = current.docType
      ? DOC_TYPE_LABELS[current.docType] || current.docType
      : 'Tài liệu'

    // New doc created (OCR just started or completed)
    if (!prevStatus) {
      switch (current.status) {
        case 'PENDING':
          // OCR is starting - no toast needed, will show in progress indicator
          break
        case 'EXTRACTED':
          toast.success(`Đã trích xuất: ${docLabel}`)
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'PARTIAL':
          toast.info(`Trích xuất một phần: ${docLabel} - cần xác minh`)
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'FAILED':
          toast.error(`Trích xuất thất bại: ${docLabel}`)
          break
      }
      return
    }

    // Status transition (e.g., PENDING → EXTRACTED)
    if (prevStatus === 'PENDING') {
      switch (current.status) {
        case 'EXTRACTED':
          toast.success(`Đã trích xuất: ${docLabel}`)
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'PARTIAL':
          toast.info(`Trích xuất một phần: ${docLabel} - cần xác minh`)
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'FAILED':
          toast.error(`Trích xuất thất bại: ${docLabel}`)
          break
      }
    }
  }, [caseId, queryClient])

  useEffect(() => {
    if (!imagesResponse?.images) return

    const currentImages = imagesResponse.images
    const previousImages = previousImagesRef.current

    // Skip notifications on initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      // Initialize previous state
      previousImagesRef.current = new Map(
        currentImages.map((img) => [img.id, { status: img.status, aiConfidence: img.aiConfidence }])
      )
      // Track images that are already processing (old/stuck data to exclude from notification)
      initialProcessingIdsRef.current = new Set(
        currentImages.filter((img) => img.status === 'PROCESSING').map((img) => img.id)
      )
      // Initial load: count is 0 (don't show notification for old stuck data)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: initializing state from fetched data
      setActiveProcessingCount(0)
      return
    }

    // Check for status changes
    for (const image of currentImages) {
      const prev = previousImages.get(image.id)

      // New image or status changed
      if (!prev || prev.status !== image.status) {
        handleStatusChange(prev?.status || null, image)
      }
    }

    // Update previous state
    previousImagesRef.current = new Map(
      currentImages.map((img) => [img.id, { status: img.status, aiConfidence: img.aiConfidence }])
    )

    // Compute active processing count (exclude initial stuck items)
    const initialIds = initialProcessingIdsRef.current
    const count = currentImages.filter(
      (img) => img.status === 'PROCESSING' && (!initialIds || !initialIds.has(img.id))
    ).length
    setActiveProcessingCount(count)
  }, [imagesResponse, handleStatusChange])

  // Track doc status changes for OCR extraction notifications
  useEffect(() => {
    if (!docsResponse?.docs) return

    const currentDocs = docsResponse.docs
    const previousDocs = previousDocsRef.current

    // Skip notifications on initial load
    if (isInitialDocsLoadRef.current) {
      isInitialDocsLoadRef.current = false
      previousDocsRef.current = new Map(
        currentDocs.map((doc) => [doc.id, { status: doc.status, docType: doc.docType }])
      )
      // Track docs that are already pending (old/stuck data to exclude from notification)
      initialPendingDocIdsRef.current = new Set(
        currentDocs.filter((doc) => doc.status === 'PENDING').map((doc) => doc.id)
      )
      // Initial load: count is 0 (don't show notification for old stuck data)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: initializing state from fetched data
      setActiveExtractingCount(0)
      return
    }

    // Check for new docs or status changes
    for (const doc of currentDocs) {
      const prev = previousDocs.get(doc.id)

      // New doc or status changed
      if (!prev || prev.status !== doc.status) {
        handleDocStatusChange(prev?.status || null, doc)
      }
    }

    // Update previous state
    previousDocsRef.current = new Map(
      currentDocs.map((doc) => [doc.id, { status: doc.status, docType: doc.docType }])
    )

    // Compute active extracting count (exclude initial stuck items)
    const initialIds = initialPendingDocIdsRef.current
    const count = currentDocs.filter(
      (doc) => doc.status === 'PENDING' && (!initialIds || !initialIds.has(doc.id))
    ).length
    setActiveExtractingCount(count)
  }, [docsResponse, handleDocStatusChange])

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      previousImagesRef.current.clear()
      previousDocsRef.current.clear()
      initialProcessingIdsRef.current = null
      initialPendingDocIdsRef.current = null
      isInitialLoadRef.current = true
      isInitialDocsLoadRef.current = true
    }
  }, [])

  return {
    images: imagesResponse?.images || [],
    docs: docsResponse?.docs || [],
    processingCount: activeProcessingCount,
    extractingCount: activeExtractingCount,
    isPolling: enabled,
  }
}
