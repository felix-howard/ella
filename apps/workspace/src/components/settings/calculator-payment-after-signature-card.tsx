import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CreditCard, Loader2, Lock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card } from '@ella/ui'
import {
  api,
  type AgreementPaymentPortalSendMode,
} from '../../lib/api-client'
import { toast } from '../../stores/toast-store'
import { useOrgRole } from '../../hooks/use-org-role'
import { CalculatorPaymentModeControl } from '../agreements/calculator-payment-mode-control'

const QUERY_KEY = ['org-settings']
const SAFE_FALLBACK_MODE: AgreementPaymentPortalSendMode = 'STAFF_REVIEW'

export function CalculatorPaymentAfterSignatureCard() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { canManageOrganizationSettings } = useOrgRole()
  const isReadOnly = !canManageOrganizationSettings

  const { data, isLoading, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => api.orgSettings.get(),
  })

  const mutation = useMutation({
    mutationFn: (mode: AgreementPaymentPortalSendMode) =>
      api.orgSettings.update({ calculatorAgreementPaymentMode: mode }),
    onSuccess: (result) => {
      queryClient.setQueryData(QUERY_KEY, result)
      toast.success(t('settings.saved'))
    },
    onError: () => {
      toast.error(t('settings.saveFailed'))
    },
  })

  const mode = data?.calculatorAgreementPaymentMode ?? SAFE_FALLBACK_MODE
  const disabled = isReadOnly || isLoading || isError || mutation.isPending

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">
              {t('settings.calculatorPaymentAfterSignature')}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('settings.calculatorPaymentAfterSignatureDescription')}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {mutation.isPending && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {isReadOnly && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <Lock className="h-3 w-3" />
              {t('settings.adminOnly')}
            </span>
          )}
        </div>
      </div>

      {isError ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {t('settings.calculatorPaymentLoadError')}
        </p>
      ) : (
        <CalculatorPaymentModeControl
          value={mode}
          name="calculator-payment-after-signature"
          disabled={disabled}
          onChange={(nextMode) => {
            if (isReadOnly || nextMode === mode) return
            mutation.mutate(nextMode)
          }}
          t={t}
        />
      )}
    </Card>
  )
}
