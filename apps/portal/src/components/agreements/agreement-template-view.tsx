/**
 * Renders agreement template sections in a scrollable container.
 * Fires `onReachBottom` once the user reaches the bottom of the agreement,
 * detected via an IntersectionObserver sentinel (more reliable than scroll
 * events on iOS Safari).
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import type { AgreementTemplateSection } from '../../lib/api-client'

interface AgreementTemplateViewProps {
  title: string
  sections: AgreementTemplateSection[]
  onReachBottom: () => void
  /** When true, suppresses the inner H2 (page hero already shows the title). */
  hideTitle?: boolean
}

export function AgreementTemplateView({
  title,
  sections,
  onReachBottom,
  hideTitle = false,
}: AgreementTemplateViewProps) {
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
  }, [markReached, sections, isDesktop])

  return (
    <div
      ref={scrollRef}
      className="min-h-0 overflow-visible overflow-x-hidden rounded-xl border border-border bg-card p-5 text-[0.9375rem] leading-relaxed text-foreground shadow-card [overflow-wrap:anywhere] sm:p-6 lg:h-full lg:min-h-[760px] lg:overflow-y-auto lg:max-h-none lg:p-8"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      {!hideTitle && (
        <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      )}
      {sections.map((section, i) => (
        <section key={`sec-${i}`} className="mb-6 last:mb-0">
          <h3 className="mb-2.5 text-base font-semibold text-foreground">{section.heading}</h3>
          <div className="space-y-2.5">
            {section.paragraphs.map((p, j) => (
              <p key={`sec-${i}-p-${j}`} className="text-foreground/85">
                {p}
              </p>
            ))}
          </div>
        </section>
      ))}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
