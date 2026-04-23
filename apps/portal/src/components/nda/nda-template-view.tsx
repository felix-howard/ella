/**
 * Renders NDA template sections in a scrollable container.
 * Fires `onReachBottom` once the user scrolls to the bottom (within a 32px
 * threshold) so the parent can enable the agree checkbox and submit flow.
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { NdaTemplateSection } from '../../lib/api-client'

interface NdaTemplateViewProps {
  title: string
  sections: NdaTemplateSection[]
  onReachBottom: () => void
}

const SCROLL_THRESHOLD_PX = 32
const FALLBACK_DELAY_MS = 10_000

export function NdaTemplateView({ title, sections, onReachBottom }: NdaTemplateViewProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const reachedRef = useRef(false)
  const onReachBottomRef = useRef(onReachBottom)
  const [showFallback, setShowFallback] = useState(false)

  // Keep latest callback reference without re-binding the scroll listener
  useEffect(() => {
    onReachBottomRef.current = onReachBottom
  }, [onReachBottom])

  const markReached = useCallback(() => {
    if (reachedRef.current) return
    reachedRef.current = true
    onReachBottomRef.current()
  }, [])

  const checkBottom = useCallback(() => {
    const el = scrollRef.current
    if (!el || reachedRef.current) return
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remaining < SCROLL_THRESHOLD_PX) markReached()
  }, [markReached])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    // Content may fit without scrolling (short template) — resolve immediately.
    if (el.scrollHeight <= el.clientHeight + SCROLL_THRESHOLD_PX) {
      markReached()
      return
    }
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(checkBottom)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    // Fallback: some iOS scroll events don't fire reliably — show a manual
    // confirmation button after a timeout so the user isn't stuck.
    const fallbackTimer = setTimeout(() => {
      if (!reachedRef.current) setShowFallback(true)
    }, FALLBACK_DELAY_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(fallbackTimer)
      el.removeEventListener('scroll', onScroll)
    }
  }, [checkBottom, markReached, sections])

  const handleManualConfirm = () => {
    setShowFallback(false)
    markReached()
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-0 overflow-y-auto border border-border rounded-md bg-card p-5 text-sm leading-relaxed"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {sections.map((section, i) => (
        <section key={`sec-${i}`} className="mb-5">
          <h3 className="font-semibold text-foreground mb-2">{section.heading}</h3>
          {section.paragraphs.map((p, j) => (
            <p key={`sec-${i}-p-${j}`} className="text-muted-foreground mb-2 last:mb-0">
              {p}
            </p>
          ))}
        </section>
      ))}
      {showFallback && (
        <div className="sticky bottom-0 pt-2 pb-1 -mx-5 px-5 bg-gradient-to-t from-card via-card to-card/0">
          <button
            type="button"
            onClick={handleManualConfirm}
            className="w-full py-2 text-sm font-medium text-primary hover:underline"
          >
            {t('nda.manualReadConfirm')}
          </button>
        </div>
      )}
    </div>
  )
}
