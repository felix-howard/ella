/**
 * Hook for lead registration form page
 * Handles org validation, form submission, and state management
 */
import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formApi } from './form-api'
import type { CampaignHeaderInfo, OrgInfo, RegistrationFormData } from './form-api'

type PageState = 'loading' | 'error' | 'form' | 'success'

interface UseRegistrationPageProps {
  orgSlug: string
  eventSlug: string
}

export function useRegistrationPage({ orgSlug, eventSlug }: UseRegistrationPageProps) {
  const { t } = useTranslation()
  const pageKey = `${orgSlug}\u0000${eventSlug}`
  const [state, setState] = useState<PageState>('loading')
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [campaignHeader, setCampaignHeader] = useState<CampaignHeaderInfo | null>(null)
  const [formIntroContent, setFormIntroContent] = useState<string | null>(null)
  const [settledPageKey, setSettledPageKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setState('loading')
    setOrg(null)
    setCampaignHeader(null)
    setFormIntroContent(null)
    setSettledPageKey(null)
    setError(null)
    setSubmitError(null)

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
            setSettledPageKey(pageKey)
            setState('error')
            return
          }
          setCampaignHeader(result.campaignHeader ?? null)
          setFormIntroContent(result.formIntroContent ?? null)
        } else {
          setCampaignHeader(null)
          setFormIntroContent(null)
        }

        setSettledPageKey(pageKey)
        setState('form')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message || t('register.errors.orgNotFound'))
        setSettledPageKey(pageKey)
        setState('error')
      })

    return () => controller.abort()
  }, [orgSlug, eventSlug, pageKey, t])

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
          smsConsentAccepted: data.smsConsentAccepted,
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

  const hasCurrentPageData = settledPageKey === pageKey
  const currentState = state === 'loading' || hasCurrentPageData ? state : 'loading'

  return {
    state: currentState,
    org: hasCurrentPageData ? org : null,
    campaignHeader: hasCurrentPageData ? campaignHeader : null,
    formIntroContent: hasCurrentPageData ? formIntroContent : null,
    error: hasCurrentPageData ? error : null,
    submitError,
    isSubmitting,
    handleSubmit,
  }
}
