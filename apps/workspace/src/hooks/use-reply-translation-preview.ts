import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError, api, type ComposeTranslationMetadata } from '../lib/api-client'
import { useDebouncedValue } from './use-debounced-value'

export const REPLY_TRANSLATION_DEBOUNCE_MS = 600

export interface ReplyTranslationPreviewSnapshot {
  translatedText: string
  sourceTextForPreview: string
  isEdited: boolean
  error: string | null
}
export interface UseReplyTranslationPreviewInput {
  enabled: boolean
  caseId?: string
  sourceText: string
}
export interface UseReplyTranslationPreviewResult extends ReplyTranslationPreviewSnapshot {
  setTranslatedText: (value: string) => void
  isLoading: boolean
  isStale: boolean
  regenerate: () => void
  reset: () => void
  restoreSnapshot: (snapshot: ReplyTranslationPreviewSnapshot) => void
}
export type ReplyTranslationSendBlockReason = 'loading' | 'error' | 'stale' | 'empty_preview'

function normalizeReplyText(value: string): string {
  return value.trim()
}

function translationErrorKey(error: unknown): string {
  if (error instanceof ApiError && error.code === 'AI_NOT_CONFIGURED') {
    return 'messages.translationUnavailable'
  }
  return 'messages.translationError'
}

export function buildReplyTranslationMetadata(
  sourceContent: string,
  edited: boolean
): ComposeTranslationMetadata {
  return {
    sourceContent: normalizeReplyText(sourceContent),
    sourceLanguage: 'EN',
    targetLanguage: 'VI',
    edited,
  }
}

export function getReplyTranslationSendBlockReason({
  enabled,
  sourceText,
  translatedText,
  sourceTextForPreview,
  isLoading,
  error,
}: {
  enabled: boolean
  sourceText: string
  translatedText: string
  sourceTextForPreview: string
  isLoading: boolean
  error: string | null
}): ReplyTranslationSendBlockReason | null {
  const source = normalizeReplyText(sourceText)
  if (!enabled || !source) return null
  if (isLoading) return 'loading'
  if (error) return 'error'
  if (source !== normalizeReplyText(sourceTextForPreview)) return 'stale'
  if (!normalizeReplyText(translatedText)) return 'empty_preview'
  return null
}

export function useReplyTranslationPreview(input: UseReplyTranslationPreviewInput): UseReplyTranslationPreviewResult {
  const { enabled, caseId, sourceText } = input
  const [translatedText, setTranslatedTextState] = useState('')
  const [sourceTextForPreview, setSourceTextForPreview] = useState('')
  const [isEdited, setIsEdited] = useState(false)
  const [isRequestLoading, setIsRequestLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const requestIdRef = useRef(0)
  const normalizedSourceText = normalizeReplyText(sourceText)
  const [debouncedSourceText, isDebouncing] = useDebouncedValue(
    normalizedSourceText,
    REPLY_TRANSLATION_DEBOUNCE_MS
  )

  const reset = useCallback(() => {
    requestIdRef.current += 1
    setTranslatedTextState('')
    setSourceTextForPreview('')
    setIsEdited(false)
    setIsRequestLoading(false)
    setError(null)
  }, [])

  const restoreSnapshot = useCallback((snapshot: ReplyTranslationPreviewSnapshot) => {
    requestIdRef.current += 1
    setTranslatedTextState(snapshot.translatedText)
    setSourceTextForPreview(snapshot.sourceTextForPreview)
    setIsEdited(snapshot.isEdited)
    setError(snapshot.error)
    setIsRequestLoading(false)
  }, [])

  const requestTranslation = useCallback(async (text: string) => {
    if (!enabled || !caseId) return
    const source = normalizeReplyText(text)
    if (!source) {
      reset()
      return
    }

    const requestId = requestIdRef.current + 1
    requestIdRef.current = requestId
    setIsRequestLoading(true)
    setError(null)

    try {
      const response = await api.messages.translateCompose({
        caseId,
        sourceText: source,
        sourceLanguage: 'EN',
        targetLanguage: 'VI',
      })
      if (requestIdRef.current !== requestId) return
      setTranslatedTextState(response.translatedText)
      setSourceTextForPreview(source)
      setIsEdited(false)
    } catch (translationError) {
      if (requestIdRef.current !== requestId) return
      setError(translationErrorKey(translationError))
    } finally {
      if (requestIdRef.current === requestId) {
        setIsRequestLoading(false)
      }
    }
  }, [caseId, enabled, reset])

  useEffect(() => {
    if (!enabled) {
      requestIdRef.current += 1
      setIsRequestLoading(false)
      setError(null)
      return
    }

    if (!normalizedSourceText) {
      reset()
      return
    }

    if (isEdited) return
    if (debouncedSourceText !== normalizedSourceText) return
    const hasCurrentPreview = debouncedSourceText === normalizeReplyText(sourceTextForPreview)
      && normalizeReplyText(translatedText)
    if (hasCurrentPreview) return

    void requestTranslation(debouncedSourceText)
  }, [
    debouncedSourceText,
    enabled,
    isEdited,
    normalizedSourceText,
    requestTranslation,
    reset,
    sourceTextForPreview,
    translatedText,
  ])

  const setTranslatedText = useCallback((value: string) => {
    setTranslatedTextState(value)
    setIsEdited(true)
    setError(null)
  }, [])

  const regenerate = useCallback(() => {
    void requestTranslation(normalizedSourceText)
  }, [normalizedSourceText, requestTranslation])

  const isStale = Boolean(enabled
    && normalizedSourceText
    && normalizedSourceText !== normalizeReplyText(sourceTextForPreview))
  const isLoading = isRequestLoading || Boolean(enabled && normalizedSourceText && isDebouncing && !isEdited)

  return {
    translatedText,
    sourceTextForPreview,
    isEdited,
    setTranslatedText,
    isLoading,
    error,
    isStale,
    regenerate,
    reset,
    restoreSnapshot,
  }
}
