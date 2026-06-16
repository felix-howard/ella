/**
 * Lead Registration Form - Public form for event lead capture
 * Route: /register/:orgSlug/:eventSlug
 */
import { createFileRoute } from '@tanstack/react-router'
import { Loader2, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useRegistrationPage } from '../../../../lib/use-registration-page'
import { resolveRegistrationHeader } from '../../../../lib/registration-header'
import { FormHeader } from '../../../../components/form/form-header'
import { RegistrationPageHeader } from '../../../../components/register/registration-page-header'
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
  const {
    state,
    org,
    campaignHeader,
    formIntroContent,
    error,
    submitError,
    isSubmitting,
    handleSubmit,
  } = useRegistrationPage({ orgSlug, eventSlug })

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

  const header = resolveRegistrationHeader({
    campaign: campaignHeader,
    fallbackTitle: t('register.title'),
    fallbackSubtitle: t('register.subtitle'),
  })
  const introSectionSpacing = header.visible ? 'pt-3' : 'pb-5 pt-3 sm:pb-6'

  return (
    <div className="flex-1 flex flex-col">
      <FormHeader orgName={org!.name} showDescription={false} variant="compact" />

      {formIntroContent && (
        <section className={`mx-auto w-full max-w-3xl px-4 sm:px-6 ${introSectionSpacing}`}>
          <div
            className="form-intro-content text-left text-foreground"
            dangerouslySetInnerHTML={{ __html: formIntroContent }}
          />
        </section>
      )}

      <RegistrationPageHeader header={header} />

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
