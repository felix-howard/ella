/**
 * Select control for the firm counter-signer; state lives in useFirmSignerChoice.
 */
import { useTranslation } from 'react-i18next'
import type { FirmSignerChoice } from './use-firm-signer-choice'

interface FirmSignerSelectProps {
  choice: FirmSignerChoice
  disabled?: boolean
}

export function FirmSignerSelect({ choice, disabled }: FirmSignerSelectProps) {
  const { t } = useTranslation()
  const { signers, isLoading, isError, firmSignerStaffId, setFirmSignerStaffId } = choice

  return (
    <label className="mt-4 block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">
        {t('agreements.wizard.fields.firmSignerLabel')}
      </span>
      {isError ? (
        <span className="block text-xs leading-5 text-destructive">
          {t('agreements.wizard.fields.firmSignerLoadError')}
        </span>
      ) : !isLoading && signers.length === 0 ? (
        <span className="block text-xs leading-5 text-destructive">
          {t('agreements.wizard.fields.firmSignerEmpty')}
        </span>
      ) : (
        <>
          <select
            value={firmSignerStaffId ?? ''}
            onChange={(e) => setFirmSignerStaffId(e.target.value)}
            disabled={disabled || isLoading}
            className="h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"
          >
            {signers.map((signer) => (
              <option key={signer.id} value={signer.id}>
                {signer.name} — {signer.title}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            {t('agreements.wizard.fields.firmSignerHint')}
          </span>
        </>
      )}
    </label>
  )
}
