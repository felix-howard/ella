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
  const { state, org, formIntroContent, error, submitError, isSubmitting, handleSubmit } =
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
      <FormHeader orgName={org!.name} showDescription={false} variant="compact" />

      {formIntroContent && (
        <section className="mx-auto w-full max-w-3xl px-4 pt-3 sm:px-6">
          <div
            className="form-intro-content text-left text-foreground"
            dangerouslySetInnerHTML={{ __html: formIntroContent }}
          />
        </section>
      )}

      <section className="mx-auto w-full max-w-3xl px-4 pb-5 pt-4 text-center sm:px-6 sm:pb-6">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {t('register.title')}
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-base leading-6 text-muted-foreground">
          {t('register.subtitle')}
        </p>
      </section>

      <div className="mx-auto w-full max-w-3xl px-4 pb-8 sm:px-6">
        <div className="overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-[0_1px_3px_rgba(15,23,42,0.06),0_20px_50px_rgba(15,23,42,0.10)] backdrop-blur">
          <RegistrationForm
            orgName={org!.name}
            onSubmit={handleSubmit}
            isSubmitting={isSubmitting}
            error={submitError || undefined}
          />
        </div>
      </div>
    </div>
  )
}
