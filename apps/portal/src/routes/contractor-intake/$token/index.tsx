/**
 * Contractor Intake Page - Public form for businesses to collect contractor info
 * Route: /contractor-intake/:token
 */
import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formApi } from '../../../lib/form-api'
import { ContractorIntakeForm, type ContractorFormData } from '../../../components/contractor-intake/contractor-intake-form'
import { ContractorIntakeSuccess } from '../../../components/contractor-intake/contractor-intake-success'

export const Route = createFileRoute('/contractor-intake/$token/')({
  component: ContractorIntakePage,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})

type PageState = 'loading' | 'error' | 'form' | 'success'

interface IntakeInfo {
  business: { name: string }
  org: { name: string; logoUrl: string | null }
  taxYear: number
}

interface SubmittedContractor {
  firstName: string
  lastName: string
  ssnLast4: string
}

function ContractorIntakePage() {
  const { token } = Route.useParams()
  const { t } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [intakeInfo, setIntakeInfo] = useState<IntakeInfo | null>(null)
  const [loadError, setLoadError] = useState<string>('')
  const [submitError, setSubmitError] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submittedContractor, setSubmittedContractor] = useState<SubmittedContractor | null>(null)
  const [submittedCount, setSubmittedCount] = useState(0)

  useEffect(() => {
    formApi
      .getIntakeInfo(token)
      .then((info) => {
        setIntakeInfo(info)
        setState('form')
      })
      .catch((err: unknown) => {
        setLoadError(err instanceof Error ? err.message : 'Invalid or expired link')
        setState('error')
      })
  }, [token])

  const handleSubmit = async (data: ContractorFormData) => {
    setIsSubmitting(true)
    setSubmitError('')
    try {
      const result = await formApi.submitContractor(token, data)
      setSubmittedContractor(result.contractor)
      setSubmittedCount((c) => c + 1)
      setState('success')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddAnother = () => {
    setSubmitError('')
    setState('form')
  }

  if (state === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <AlertCircle className="w-12 h-12 text-destructive mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-2">
          {t('contractorIntake.invalidLink')}
        </h2>
        <p className="text-muted-foreground">{loadError || t('contractorIntake.invalidLinkMessage')}</p>
      </div>
    )
  }

  if (state === 'success' && submittedContractor) {
    return (
      <ContractorIntakeSuccess
        contractor={submittedContractor}
        submittedCount={submittedCount}
        onAddAnother={handleAddAnother}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="text-center py-8 px-6 border-b border-border/50">
        {intakeInfo?.org?.logoUrl && (
          <img src={intakeInfo.org.logoUrl} alt="" className="h-10 mx-auto mb-4" />
        )}
        <h1 className="text-xl font-bold text-foreground">{intakeInfo?.business.name}</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t('contractorIntake.subtitle')}
        </p>
      </div>

      <ContractorIntakeForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={submitError || undefined}
      />
    </div>
  )
}
