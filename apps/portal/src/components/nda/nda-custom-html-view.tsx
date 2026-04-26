/**
 * Renders sanitized NDA custom HTML in a scrollable container.
 * Mirrors NdaTemplateView's IntersectionObserver sentinel pattern so the
 * scroll-to-bottom gate behaves identically across rendering modes.
 *
 * Defence-in-depth: server already sanitized at write; sanitizeNdaHtmlClient
 * strips anything that slipped past or was injected post-fetch.
 */
import { useEffect, useRef, useCallback, useMemo } from 'react'
import { sanitizeNdaHtmlClient } from '../../lib/sanitize-nda-html'

interface NdaCustomHtmlViewProps {
  title: string
  html: string
  onReachBottom: () => void
}

export function NdaCustomHtmlView({ title, html, onReachBottom }: NdaCustomHtmlViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reachedRef = useRef(false)
  const onReachBottomRef = useRef(onReachBottom)

  useEffect(() => {
    onReachBottomRef.current = onReachBottom
  }, [onReachBottom])

  const safeHtml = useMemo(() => sanitizeNdaHtmlClient(html), [html])

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
      { root, rootMargin: '0px 0px 48px 0px', threshold: 0 },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [markReached, safeHtml])

  return (
    <div
      ref={scrollRef}
      className="nda-custom-html-view flex-1 min-h-[480px] overflow-y-auto border border-border rounded-md bg-card p-5 text-sm leading-relaxed text-foreground"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      <div
        className="nda-custom-html-content text-foreground/90"
        dangerouslySetInnerHTML={{ __html: safeHtml }}
      />
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
