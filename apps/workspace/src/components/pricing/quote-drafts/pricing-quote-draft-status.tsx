import { Button } from '@ella/ui'
import type { PricingQuoteDraftAutosaveState } from './use-pricing-quote-draft-autosave'

interface PricingQuoteDraftStatusProps {
  state: PricingQuoteDraftAutosaveState
  onRetry: () => void
  onReload: () => void
  disabled?: boolean
}

export function PricingQuoteDraftStatus({
  state,
  onRetry,
  onReload,
  disabled = false,
}: PricingQuoteDraftStatusProps) {
  if (state === 'idle') return null

  const label = {
    saved: 'Saved',
    unsaved: 'Unsaved changes',
    saving: 'Saving…',
    failed: 'Could not save',
    conflict: 'Changed elsewhere',
  }[state]

  return (
    <span className={state === 'failed' || state === 'conflict' ? 'text-error' : undefined}>
      {label}
      {state === 'failed' && (
        <>
          {' — '}
          <Button type="button" variant="link" size="sm" disabled={disabled} onClick={onRetry}>
            Retry
          </Button>
        </>
      )}
      {state === 'conflict' && (
        <>
          {' — '}
          <Button type="button" variant="link" size="sm" disabled={disabled} onClick={onReload}>
            Reload draft
          </Button>
        </>
      )}
    </span>
  )
}
