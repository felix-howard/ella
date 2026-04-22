/**
 * SharedDocLinkBar — state-driven magic link row.
 * Uses `computeLinkState` to render 1 of 4 states: active / paused / expired / none.
 * Active state is rendered by ActiveLinkPanel to keep this file focused on state selection.
 */
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { PauseCircle, PlayCircle } from 'lucide-react'
import { Button } from '@ella/ui'
import { toast } from '../../stores/toast-store'
import { useSharedDocs, type ExtendDuration } from '../../hooks/use-shared-docs'
import { computeLinkState } from './compute-link-state'
import { ExpiryBadge } from './expiry-badge'
import { ExtendLinkMenu } from './extend-link-menu'
import { GenerateLinkButton } from './generate-link-button'
import { ActiveLinkPanel } from './active-link-panel'
import { PauseLinkModal } from './pause-link-modal'
import type { SharedDocMagicLinkData } from '../../lib/api-client'

interface SharedDocLinkBarProps {
  sectionId: string
  caseId: string
  magicLink: SharedDocMagicLinkData | null
  viewCount: number
}

export function SharedDocLinkBar({
  sectionId,
  caseId,
  magicLink,
  viewCount,
}: SharedDocLinkBarProps) {
  const { t, i18n } = useTranslation()
  const {
    extendSection,
    isExtending,
    pauseSection,
    isPausing,
    resumeSection,
    isResuming,
    generateLink,
    isGeneratingLink,
  } = useSharedDocs({ caseId })

  const [showPauseModal, setShowPauseModal] = useState(false)

  const linkState = computeLinkState({
    linkExists: !!magicLink,
    isActive: magicLink?.isActive,
    expiresAt: magicLink?.expiresAt ?? null,
  })

  const handleExtend = useCallback(
    async (duration: ExtendDuration) => {
      try {
        await extendSection({ id: sectionId, duration })
        toast.success(t('sharedDocs.extendSuccess'))
      } catch (err) {
        console.error('[shared-docs] extend failed', err)
        toast.error(t('sharedDocs.extendError'))
      }
    },
    [sectionId, extendSection, t]
  )

  const handlePauseConfirm = useCallback(async () => {
    try {
      await pauseSection(sectionId)
      toast.success(t('sharedDocs.pauseSuccess'))
      setShowPauseModal(false)
    } catch (err) {
      console.error('[shared-docs] pause failed', err)
      toast.error(t('sharedDocs.pauseError'))
    }
  }, [sectionId, pauseSection, t])

  const handleResume = useCallback(async () => {
    try {
      await resumeSection(sectionId)
      toast.success(t('sharedDocs.resumeSuccess'))
    } catch (err) {
      console.error('[shared-docs] resume failed', err)
      toast.error(t('sharedDocs.resumeError'))
    }
  }, [sectionId, resumeSection, t])

  const handleGenerate = useCallback(async () => {
    try {
      await generateLink(sectionId)
      toast.success(t('sharedDocs.generateSuccess'))
    } catch (err) {
      console.error('[shared-docs] generate failed', err)
      toast.error(t('sharedDocs.generateError'))
    }
  }, [sectionId, generateLink, t])

  if (linkState.state === 'none') {
    return (
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{t('sharedDocs.linkState.noLink')}</span>
        <GenerateLinkButton onClick={handleGenerate} isLoading={isGeneratingLink} />
      </div>
    )
  }

  if (linkState.state === 'paused') {
    return (
      <div className="flex items-center justify-between gap-2 bg-muted/40 rounded-md px-3 py-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <PauseCircle className="w-3.5 h-3.5" />
          {t('sharedDocs.linkState.paused')}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleResume}
          disabled={isResuming}
          className="gap-1.5 h-8"
        >
          <PlayCircle className="w-3.5 h-3.5" />
          {t('sharedDocs.actions.resume')}
        </Button>
      </div>
    )
  }

  if (linkState.state === 'expired') {
    return (
      <div className="flex items-center justify-between gap-2 bg-destructive/5 rounded-md px-3 py-2">
        <ExpiryBadge result={linkState} language={i18n.language} />
        <ExtendLinkMenu onSelect={handleExtend} isLoading={isExtending} variant="solid" />
      </div>
    )
  }

  // active — magicLink guaranteed non-null (linkExists + isActive branches above)
  if (!magicLink) return null

  return (
    <>
      <ActiveLinkPanel
        url={magicLink.url}
        viewCount={viewCount}
        linkState={linkState}
        language={i18n.language}
        isExtending={isExtending}
        isPausing={isPausing}
        onExtend={handleExtend}
        onPauseClick={() => setShowPauseModal(true)}
      />
      <PauseLinkModal
        isOpen={showPauseModal}
        onClose={() => setShowPauseModal(false)}
        onConfirm={handlePauseConfirm}
        isLoading={isPausing}
      />
    </>
  )
}
