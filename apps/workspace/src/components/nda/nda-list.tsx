/**
 * Renders the list of NDAs for a given entity (lead or client).
 * Pure presentation — parent owns the useNdaList query so it can pass `ndas`
 * to SendNdaButton for disabled-state logic without double fetching.
 */
import { useTranslation } from 'react-i18next'
import { FileSignature, Loader2 } from 'lucide-react'
import { NdaCard } from './nda-card'
import type { NdaAgreement } from '../../lib/api-client'
import type { EntityRef } from './types'

interface Props {
  entity: EntityRef
  ndas: NdaAgreement[]
  isLoading: boolean
  isError: boolean
}

export function NdaList({ entity, ndas, isLoading, isError }: Props) {
  const { t } = useTranslation()

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
      {ndas.map((nda) => (
        <NdaCard key={nda.id} entity={entity} nda={nda} />
      ))}
    </div>
  )
}
