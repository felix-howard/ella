/**
 * Lead Registration Form - Public form for event lead capture
 * Route: /register/:orgSlug/:eventSlug
 */
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegistrationPage } from '../../../../lib/use-registration-page'
import { FormHeader } from '../../../../components/form/form-header'
import { RegistrationForm } from '../../../../components/register/registration-form'
import { RegistrationSuccess } from '../../../../components/register/registration-success'

export const Route = createFileRoute('/register/$orgSlug/$eventSlug/')({
  component: RegisterPage,
  head: () => ({
    meta: [{ name: 'robots', content: 'noindex, nofollow' }],
  }),
})

function RegisterPage() {
  const { orgSlug, eventSlug } = Route.useParams()
  const { t } = useTranslation()
  const { state, org, error, submitError, isSubmitting, handleSubmit } =
    useRegistrationPage({ orgSlug, eventSlug })

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
          {error || t('register.errors.orgNotFound')}
        </h2>
      </div>
    )
  }

  if (state === 'success') {
    return <RegistrationSuccess />
  }

  return (
    <div className="flex-1 flex flex-col">
      <FormHeader orgName={org!.name} showDescription={false} />

      {/* Registration subtitle */}
      <div className="px-6 py-4 text-center">
        <h2 className="text-lg font-semibold text-foreground">
          {t('register.title')}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('register.subtitle')}
        </p>
      </div>

      {/* Form */}
      <div className="px-4 pb-6">
        <div className="bg-card rounded-xl shadow-sm border border-border">
          <RegistrationForm
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={submitError || undefined}
          />
        </div>
      </div>
    </div>
  )
}
