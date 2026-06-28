import { config } from './config'

export function getEffectiveFirmPhone(storedFirmPhone?: string | null): string | null {
  return config.twilio.phoneNumber.trim() || storedFirmPhone?.trim() || null
}

export function hasRequiredFirmContact(input: {
  firmPhone?: string | null
  firmEmail?: string | null
}): boolean {
  return Boolean(getEffectiveFirmPhone(input.firmPhone) && input.firmEmail?.trim())
}
