/**
 * Renders the list of agreements for a given entity (lead or client).
 * Pure presentation — parent owns the useAgreementsList query so it can pass
 * `ndas` to SendAgreementButton for disabled-state logic without double fetching.
 */
import { useTranslation } from 'react-i18next'
import { useEffect, useMemo, useRef } from 'react'
import { FileSignature, Loader2 } from 'lucide-react'
import { NdaCard } from './agreement-card'
import type { Agreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  entity: EntityRef
  /** Prop name kept as `ndas` to minimize callsite churn during the rename. */
  ndas: Agreement[]
  isLoading: boolean
  isError: boolean
  focusedAgreementId?: string
}

export function NdaList({
  entity,
  ndas,
  isLoading,
  isError,
  focusedAgreementId,
}: Props) {
  const { t } = useTranslation()
  const focusedAgreementRef = useRef<HTMLDivElement>(null)
  const sortedAgreements = useMemo(
    () => ndas
      .map((nda, index) => ({ nda, index }))
      .sort((left, right) => {
        const leftIsDraft = left.nda.status === 'DRAFT'
        const rightIsDraft = right.nda.status === 'DRAFT'
        if (leftIsDraft && rightIsDraft) {
          const updatedDelta =
            new Date(right.nda.updatedAt).getTime() - new Date(left.nda.updatedAt).getTime()
          return updatedDelta || left.index - right.index
        }
        if (leftIsDraft !== rightIsDraft) return leftIsDraft ? -1 : 1
        return left.index - right.index
      })
      .map(({ nda }) => nda),
    [ndas],
  )

  useEffect(() => {
    const target = focusedAgreementRef.current
    if (!target) return

    const frameId = window.requestAnimationFrame(() => {
      target.focus({ preventScroll: true })
      target.scrollIntoView({
        behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
        block: 'center',
      })
    })
    return () => window.cancelAnimationFrame(frameId)
  }, [focusedAgreementId, sortedAgreements])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/10 text-destructive text-sm">
        {t('nda.list.loadError')}
      </div>
    )
  }

  if (ndas.length === 0) {
    return (
      <div className="bg-muted/30 rounded-lg p-6 text-center">
        <FileSignature className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{t('nda.list.empty')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {sortedAgreements.map((nda) => (
        <div
          key={nda.id}
          ref={nda.id === focusedAgreementId ? focusedAgreementRef : undefined}
          tabIndex={nda.id === focusedAgreementId ? -1 : undefined}
          data-agreement-id={nda.id}
          data-focused-agreement={nda.id === focusedAgreementId ? 'true' : undefined}
          className={
            nda.id === focusedAgreementId
              ? 'rounded-xl ring-2 ring-primary ring-offset-2 transition-shadow'
              : undefined
          }
        >
          <NdaCard entity={entity} nda={nda} />
        </div>
      ))}
    </div>
  )
}
