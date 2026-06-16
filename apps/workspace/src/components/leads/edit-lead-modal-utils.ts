import type { TFunction } from 'i18next'
import type { Lead } from '../../lib/api-client'
import { formatPhoneInput } from '../../lib/formatters'

export interface EditLeadFormData {
  firstName: string
  lastName: string
  phone: string
  email: string
  businessName: string
}

export interface EditLeadFormErrors {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  submit?: string
}

export interface EditLeadUpdatePayload {
  firstName?: string
  lastName?: string
  phone?: string
  email?: string | null
  businessName?: string | null
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isMaskedPhone = (phone: string) => phone.includes('*')

export const canEditLeadPhone = (phone: string) => !isMaskedPhone(phone)

const getLocalPhoneDigits = (phone: string) => {
  const digits = phone.replace(/\D/g, '')
  return digits.length > 10 && digits.startsWith('1') ? digits.slice(1) : digits
}

export const formatLeadPhoneInput = (phone: string) => formatPhoneInput(getLocalPhoneDigits(phone))

export const toE164Phone = (phone: string) => `+1${getLocalPhoneDigits(phone).slice(0, 10)}`

export function buildInitialEditLeadForm(lead: Lead): EditLeadFormData {
  return {
    firstName: lead.firstName,
    lastName: lead.lastName,
    phone: isMaskedPhone(lead.phone) ? lead.phone : formatLeadPhoneInput(lead.phone),
    email: lead.email ?? '',
    businessName: lead.businessName ?? '',
  }
}

export function validateEditLeadForm(
  form: EditLeadFormData,
  t: TFunction,
  options: { validatePhone: boolean }
): EditLeadFormErrors {
  const next: EditLeadFormErrors = {}
  if (!form.firstName.trim()) {
    next.firstName = t('newClient.errorFirstNameRequired', 'First name is required')
  }
  if (!form.lastName.trim()) {
    next.lastName = t('newClient.errorLastNameRequired', 'Last name is required')
  }

  if (options.validatePhone) {
    const phoneDigits = getLocalPhoneDigits(form.phone)
    if (!phoneDigits) {
      next.phone = t('newClient.errorPhoneRequired', 'Phone is required')
    } else if (phoneDigits.length !== 10) {
      next.phone = t('newClient.errorPhoneLength', 'Phone must be 10 digits')
    }
  }

  const email = form.email.trim()
  if (email && !EMAIL_PATTERN.test(email)) {
    next.email = t('newClient.errorEmailInvalid', 'Invalid email')
  }

  return next
}

export function buildEditLeadUpdatePayload(
  form: EditLeadFormData,
  initialForm: EditLeadFormData,
  options: { canEditPhone: boolean }
): EditLeadUpdatePayload {
  const payload: EditLeadUpdatePayload = {}

  const firstName = form.firstName.trim().slice(0, 100)
  if (firstName !== initialForm.firstName.trim()) payload.firstName = firstName

  const lastName = form.lastName.trim().slice(0, 100)
  if (lastName !== initialForm.lastName.trim()) payload.lastName = lastName

  if (options.canEditPhone && form.phone !== initialForm.phone) {
    payload.phone = toE164Phone(form.phone)
  }

  const email = form.email.trim()
  if (email !== initialForm.email.trim()) payload.email = email || null

  const businessName = form.businessName.trim()
  if (businessName !== initialForm.businessName.trim()) payload.businessName = businessName || null

  return payload
}
