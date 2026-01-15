/**
 * Classification Updates Hook - Polls for image status changes
 * Shows toast notifications when classification completes
 * Invalidates checklist query when images are linked
 */

import { useEffect, useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type RawImage } from '../lib/api-client'
import { toast } from '../stores/toast-store'
import { DOC_TYPE_LABELS } from '../lib/constants'

interface UseClassificationUpdatesOptions {
  caseId: string | undefined
  enabled?: boolean
  refetchInterval?: number
}

// Track previous image states for comparison
type ImageStatusMap = Map<string, { status: string; aiConfidence: number | null }>

export function useClassificationUpdates({
  caseId,
  enabled = true,
  refetchInterval = 5000, // 5 seconds default
}: UseClassificationUpdatesOptions) {
  const queryClient = useQueryClient()
  const previousImagesRef = useRef<ImageStatusMap>(new Map())
  const isInitialLoadRef = useRef(true)

  const { data: imagesResponse } = useQuery({
    queryKey: ['images', caseId],
    queryFn: () => api.cases.getImages(caseId!),
    enabled: !!caseId && enabled,
    refetchInterval: enabled ? refetchInterval : false,
    refetchIntervalInBackground: false, // Only poll when tab active
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
  }, [imagesResponse, handleStatusChange])

  // Cleanup on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      previousImagesRef.current.clear()
      isInitialLoadRef.current = true
    }
  }, [])

  // Count images being processed
  const processingCount = imagesResponse?.images?.filter(
    (img) => img.status === 'PROCESSING'
  ).length || 0

  return {
    images: imagesResponse?.images || [],
    processingCount,
    isPolling: enabled,
  }
}
