/**
 * Hook for lead registration form page
 * Handles org validation, form submission, and state management
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formApi } from './form-api'
import type { OrgInfo, RegistrationFormData } from './form-api'

type PageState = 'loading' | 'error' | 'form' | 'success'

interface UseRegistrationPageProps {
  orgSlug: string
  eventSlug: string
}

export function useRegistrationPage({ orgSlug, eventSlug }: UseRegistrationPageProps) {
  const { t } = useTranslation()
  const [state, setState] = useState<PageState>('loading')
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    formApi
      .getOrgInfo(orgSlug)
      .then(async (data) => {
        if (controller.signal.aborted) return
        setOrg(data.org)

        // Validate campaign slug if provided
        if (eventSlug) {
          const result = await formApi.validateCampaign(orgSlug, eventSlug)
          if (controller.signal.aborted) return
          if (!result.valid) {
            setError(t('register.errors.campaignNotFound'))
            setState('error')
            return
          }
        }

        setState('form')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message || t('register.errors.orgNotFound'))
        setState('error')
      })

    return () => controller.abort()
  }, [orgSlug, t])

  const handleSubmit = useCallback(
    async (data: RegistrationFormData) => {
      setIsSubmitting(true)
      setSubmitError(null)

      try {
        const result = await formApi.createLead({
          firstName: data.firstName.trim(),
          lastName: data.lastName.trim(),
          phone: data.phone.replace(/\D/g, ''),
          email: data.email.trim() || undefined,
          businessName: data.businessName.trim() || undefined,
          orgSlug,
          eventSlug,
        })

        if (result.success) {
          setState('success')
        } else {
          setSubmitError(result.error || t('register.errors.submitFailed'))
        }
      } catch {
        setSubmitError(t('register.errors.submitFailed'))
      } finally {
        setIsSubmitting(false)
      }
    },
    [orgSlug, eventSlug, t]
  )

  return { state, org, error, submitError, isSubmitting, handleSubmit }
}
