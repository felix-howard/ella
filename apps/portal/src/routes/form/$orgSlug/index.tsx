/**
 * Generic Form Page - Public intake form for org-level client registration
 * Route: /form/:orgSlug
 */
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFormPage } from '../../../lib/use-form-page'
import { FormHeader } from '../../../components/form/form-header'
import { IntakeForm } from '../../../components/form/intake-form'
import { SuccessView } from '../../../components/form/success-view'

export const Route = createFileRoute('/form/$orgSlug/')({
  component: GenericFormPage,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})

function GenericFormPage() {
  const { orgSlug } = Route.useParams()
  const { t } = useTranslation()
  const { state, org, error, submitError, isSubmitting, smsSent, handleSubmit } =
    useFormPage({ orgSlug })

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
          {t('form.notFound')}
        </h2>
        <p className="text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (state === 'success') {
    return <SuccessView smsSent={smsSent} />
  }

  return (
    <div className="flex-1 flex flex-col">
      <FormHeader orgName={org!.name} />
      <IntakeForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        error={submitError || undefined}
      />
    </div>
  )
}
