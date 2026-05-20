/**
 * Renders sanitized agreement custom HTML in a scrollable container.
 * Mirrors AgreementTemplateView's IntersectionObserver sentinel pattern so the
 * scroll-to-bottom gate behaves identically across rendering modes.
 *
 * Defence-in-depth: server already sanitized at write; sanitizeAgreementHtmlClient
 * strips anything that slipped past or was injected post-fetch.
 */
import { useEffect, useRef, useCallback, useMemo, useState } from 'react'
import {
  formatAgreementHtmlForReading,
  sanitizeAgreementHtmlClient,
} from '../../lib/sanitize-agreement-html'

interface AgreementCustomHtmlViewProps {
  title: string
  html: string
  onReachBottom: () => void
  /** When true, suppresses the inner H2 (page hero already shows the title). */
  hideTitle?: boolean
}

export function AgreementCustomHtmlView({
  title,
  html,
  onReachBottom,
  hideTitle = false,
}: AgreementCustomHtmlViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reachedRef = useRef(false)
  const onReachBottomRef = useRef(onReachBottom)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    onReachBottomRef.current = onReachBottom
  }, [onReachBottom])

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(media.matches)
    update()

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }

    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  const safeHtml = useMemo(
    () => formatAgreementHtmlForReading(sanitizeAgreementHtmlClient(html)),
    [html],
  )

  const markReached = useCallback(() => {
    if (reachedRef.current) return
    reachedRef.current = true
    onReachBottomRef.current()
  }, [])

  useEffect(() => {
    const root = scrollRef.current
    const sentinel = sentinelRef.current
    if (!root || !sentinel) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            markReached()
            observer.disconnect()
            break
          }
        }
      },
      { root: isDesktop ? root : null, rootMargin: '0px 0px 48px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [markReached, safeHtml, isDesktop])

  return (
    <div
      ref={scrollRef}
      className="agreement-custom-html-view min-h-0 overflow-visible overflow-x-hidden rounded-xl border border-border bg-card p-5 text-foreground shadow-card [overflow-wrap:anywhere] sm:p-6 lg:h-full lg:min-h-[760px] lg:overflow-y-auto lg:max-h-none lg:p-10"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      {!hideTitle && (
        <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      )}
      <div
        className="agreement-custom-html-content text-foreground/90"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
