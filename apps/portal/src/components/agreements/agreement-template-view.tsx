/**
 * Renders agreement template sections in a scrollable container.
 * Fires `onReachBottom` once the user reaches the bottom of the agreement,
 * detected via an IntersectionObserver sentinel (more reliable than scroll
 * events on iOS Safari).
 */
import { useEffect, useRef, useCallback } from 'react'
import type {
  AgreementTemplateSection,
  AgreementFirmSnapshot,
  AgreementClientSnapshot,
} from '../../lib/api-client'
import { AgreementHeaderBlock } from './agreement-header-block'

interface AgreementTemplateViewProps {
  title: string
  sections: AgreementTemplateSection[]
  onReachBottom: () => void
  firmSnapshot?: AgreementFirmSnapshot | null
  clientSnapshot?: AgreementClientSnapshot | null
}

export function AgreementTemplateView({
  title,
  sections,
  onReachBottom,
  firmSnapshot,
  clientSnapshot,
}: AgreementTemplateViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const reachedRef = useRef(false)
  const onReachBottomRef = useRef(onReachBottom)

  useEffect(() => {
    onReachBottomRef.current = onReachBottom
  }, [onReachBottom])

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
  }, [markReached, sections])

  return (
    <div
      ref={scrollRef}
      className="flex-1 min-h-[480px] overflow-y-auto border border-border rounded-md bg-card p-5 text-sm leading-relaxed text-foreground"
      role="region"
      aria-label={title}
      tabIndex={0}
    >
      <h2 className="text-lg font-semibold text-foreground mb-4">{title}</h2>
      {firmSnapshot && clientSnapshot && (
        <AgreementHeaderBlock firm={firmSnapshot} client={clientSnapshot} />
      )}
      {sections.map((section, i) => (
        <section key={`sec-${i}`} className="mb-5">
          <h3 className="font-semibold text-foreground mb-2">{section.heading}</h3>
          {section.paragraphs.map((p, j) => (
            <p key={`sec-${i}-p-${j}`} className="text-foreground/90 mb-2 last:mb-0">
              {p}
            </p>
          ))}
        </section>
      ))}
      <div ref={sentinelRef} aria-hidden="true" />
    </div>
  )
}
