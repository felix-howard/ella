import type { StaffPaymentCountry, StaffPaymentInfoSummary } from '../../lib/api-client'

export const PAYMENT_COUNTRIES = ['US', 'VN', 'PH'] as const

export const PAYMENT_COUNTRY_LABELS: Record<StaffPaymentCountry, string> = {
  US: 'United States',
  VN: 'Vietnam',
  PH: 'Philippines',
}

const ACCOUNT_NUMBER_RULES: Record<StaffPaymentCountry, { min: number; max: number }> = {
  US: { min: 4, max: 17 },
  VN: { min: 6, max: 20 },
  PH: { min: 6, max: 20 },
}

export interface PaymentInfoFormValues {
  nameOnAccount: string
  bankName: string
  accountNumber: string
  routingNumber: string
}

export type PaymentInfoFormErrors = Partial<Record<keyof PaymentInfoFormValues, string>>

export function getDefaultPaymentCountry(infos: StaffPaymentInfoSummary[]): StaffPaymentCountry {
  return PAYMENT_COUNTRIES.find((country) => infos.some((info) => info.country === country)) ?? 'US'
}

export function findPaymentInfo(
  infos: StaffPaymentInfoSummary[],
  country: StaffPaymentCountry
): StaffPaymentInfoSummary | null {
  return infos.find((info) => info.country === country) ?? null
}

export function maskedEnding(last4: string | null | undefined): string {
  return last4 ? `Saved ending in ${last4}` : 'Not saved'
}

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

export function isValidRoutingNumber(routing: string): boolean {
  const digits = digitsOnly(routing)
  if (digits.length !== 9) return false

  const parts = digits.split('').map(Number)
  const checksum =
    3 * (parts[0] + parts[3] + parts[6]) +
    7 * (parts[1] + parts[4] + parts[7]) +
    (parts[2] + parts[5] + parts[8])

  return checksum % 10 === 0
}

export function validatePaymentInfoForm(
  country: StaffPaymentCountry,
  values: PaymentInfoFormValues
): PaymentInfoFormErrors {
  const errors: PaymentInfoFormErrors = {}
  const accountNumber = digitsOnly(values.accountNumber)
  const accountRule = ACCOUNT_NUMBER_RULES[country]

  if (!values.nameOnAccount.trim()) errors.nameOnAccount = 'profile.paymentInfo.validation.nameRequired'
  if (!values.bankName.trim()) errors.bankName = 'profile.paymentInfo.validation.bankRequired'
  if (!accountNumber) {
    errors.accountNumber = 'profile.paymentInfo.validation.accountRequired'
  } else if (accountNumber !== values.accountNumber.trim()) {
    errors.accountNumber = 'profile.paymentInfo.validation.accountDigits'
  } else if (accountNumber.length < accountRule.min || accountNumber.length > accountRule.max) {
    errors.accountNumber = 'profile.paymentInfo.validation.accountLength'
  }

  if (country === 'US' && !isValidRoutingNumber(values.routingNumber)) {
    errors.routingNumber = 'profile.paymentInfo.validation.routingInvalid'
  }

  return errors
}

export function hasPaymentInfoErrors(errors: PaymentInfoFormErrors): boolean {
  return Object.values(errors).some(Boolean)
}
