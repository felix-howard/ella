/**
 * Classification Updates Hook - Polls for image status changes
 * Shows toast notifications when classification completes
 * Invalidates checklist query when images are linked
 */

import { useEffect, useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
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

// Consider images "stuck" if processing for longer than this (5 minutes)
const STUCK_THRESHOLD_MS = 5 * 60 * 1000

export function useClassificationUpdates({
  caseId,
  enabled = true,
  refetchInterval = 5000, // 5 seconds default
}: UseClassificationUpdatesOptions) {
  const { t } = useTranslation()
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
      : t('classification.document')

    switch (current.status) {
      case 'CLASSIFIED': {
        const confidence = Math.round((current.aiConfidence || 0) * 100)
        if (current.aiConfidence && current.aiConfidence >= 0.85) {
          toast.success(`${docLabel} (${confidence}%)`)
        } else if (current.aiConfidence && current.aiConfidence >= 0.60) {
          toast.info(t('classification.needsVerification', { docLabel, confidence }))
        } else {
          toast.info(t('classification.lowConfidence', { docLabel }))
        }
        // Refresh checklist for potential status updates
        queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
        break
      }

      case 'LINKED':
        toast.success(t('classification.linked', { docLabel }))
        queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
        break

      case 'UNCLASSIFIED':
        // Check if confidence is 0 (AI service likely unavailable or failed)
        if (!current.aiConfidence || current.aiConfidence === 0) {
          toast.error(t('classification.aiFailed', { filename: current.filename }))
        } else {
          toast.info(t('classification.needsReview', { filename: current.filename }))
        }
        break

      case 'BLURRY':
        toast.error(t('classification.blurry', { filename: current.filename }))
        break

      case 'DUPLICATE':
        toast.info(t('classification.duplicate', { filename: current.filename }))
        break
    }
  }, [t, caseId, queryClient])

  /**
   * Handle doc OCR status transition notifications
   * Shows toast when OCR extraction completes or fails
   */
  const handleDocStatusChange = useCallback((prevStatus: string | null, current: DigitalDoc) => {
    const docLabel = current.docType
      ? DOC_TYPE_LABELS[current.docType] || current.docType
      : t('classification.document')

    // New doc created (OCR just started or completed)
    if (!prevStatus) {
      switch (current.status) {
        case 'PENDING':
          // OCR is starting - no toast needed, will show in progress indicator
          break
        case 'EXTRACTED':
          toast.success(t('ocr.extracted', { docLabel }))
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'PARTIAL':
          toast.info(t('ocr.partial', { docLabel }))
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'FAILED':
          toast.error(t('ocr.failed', { docLabel }))
          break
      }
      return
    }

    // Status transition (e.g., PENDING → EXTRACTED)
    if (prevStatus === 'PENDING') {
      switch (current.status) {
        case 'EXTRACTED':
          toast.success(t('ocr.extracted', { docLabel }))
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'PARTIAL':
          toast.info(t('ocr.partial', { docLabel }))
          queryClient.invalidateQueries({ queryKey: ['checklist', caseId] })
          break
        case 'FAILED':
          toast.error(t('ocr.failed', { docLabel }))
          break
      }
    }
  }, [t, caseId, queryClient])

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
      // Track images that are truly stuck (processing for > 5 minutes)
      const now = Date.now()
      initialProcessingIdsRef.current = new Set(
        currentImages
          .filter((img) => {
            if (img.status !== 'PROCESSING') return false
            const updatedAt = new Date(img.updatedAt).getTime()
            return now - updatedAt > STUCK_THRESHOLD_MS // Only mark as stuck if older than 5 min
          })
          .map((img) => img.id)
      )
      // Count actively processing images (not stuck) on initial load
      const activeCount = currentImages.filter(
        (img) => img.status === 'PROCESSING' && !initialProcessingIdsRef.current?.has(img.id)
      ).length
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: initializing state from fetched data
      setActiveProcessingCount(activeCount)
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
      // Track docs that are truly stuck (pending for > 5 minutes)
      const now = Date.now()
      initialPendingDocIdsRef.current = new Set(
        currentDocs
          .filter((doc) => {
            if (doc.status !== 'PENDING') return false
            const updatedAt = new Date(doc.updatedAt).getTime()
            return now - updatedAt > STUCK_THRESHOLD_MS // Only mark as stuck if older than 5 min
          })
          .map((doc) => doc.id)
      )
      // Count actively extracting docs (not stuck) on initial load
      const activeCount = currentDocs.filter(
        (doc) => doc.status === 'PENDING' && !initialPendingDocIdsRef.current?.has(doc.id)
      ).length
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Valid: initializing state from fetched data
      setActiveExtractingCount(activeCount)
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
