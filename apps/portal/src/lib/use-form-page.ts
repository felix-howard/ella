/**
 * Shared hook for intake form pages (generic + staff-specific)
 * Handles org/staff info fetching, form submission, and state management
 */
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { formApi, type OrgInfo, type StaffInfo } from './form-api'
import type { IntakeFormData } from '../components/form/intake-form'

type PageState = 'loading' | 'form' | 'success' | 'error'

interface UseFormPageOptions {
  orgSlug: string
  staffSlug?: string
}

export function useFormPage({ orgSlug, staffSlug }: UseFormPageOptions) {
  const { t, i18n } = useTranslation()

  const [state, setState] = useState<PageState>('loading')
  const [org, setOrg] = useState<OrgInfo | null>(null)
  const [staff, setStaff] = useState<StaffInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [smsSent, setSmsSent] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const fetchInfo = staffSlug
      ? formApi.getStaffFormInfo(orgSlug, staffSlug)
      : formApi.getOrgInfo(orgSlug)

    fetchInfo
      .then((data) => {
        if (controller.signal.aborted) return
        setOrg(data.org)
        setStaff(data.staff || null)
        setState('form')
      })
      .catch((err) => {
        if (controller.signal.aborted) return
        setError(err.message)
        setState('error')
      })

    return () => controller.abort()
  }, [orgSlug, staffSlug])

  const handleSubmit = async (data: IntakeFormData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      const result = await formApi.submit(orgSlug, {
        clientType: data.clientType,
        firstName: data.firstName || undefined,
        lastName: data.lastName || undefined,
        phone: data.phone || undefined,
        email: data.email || undefined,
        taxYear: data.taxYear,
        language: i18n.language.startsWith('vi') ? 'VI' : 'EN',
        staffSlug,
        // Business fields
        businessName: data.businessName,
        businessType: data.businessType,
        businessEin: data.businessEin,
        businessPhone: data.businessPhone,
        businessEmail: data.businessEmail,
        businessAddress: data.businessAddress,
        businessCity: data.businessCity,
        businessState: data.businessState,
        businessZip: data.businessZip,
      })
      setSmsSent(result.smsSent)
      setState('success')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : t('form.submitError'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return { state, org, staff, error, submitError, isSubmitting, smsSent, handleSubmit }
}
