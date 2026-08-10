import { GoogleDriveServiceError } from './google-drive-errors'

export type ClientDriveBusinessMode = 'MULTI' | 'SINGLE_BUSINESS'

export interface BuildClientDriveFolderNameInput {
  clientName: string
  ssnLast4: string
  state: string
  businessMode: ClientDriveBusinessMode
  businessName?: string | null
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeClientDriveState(value: string): string {
  return normalizeWhitespace(value).toUpperCase()
}

export function buildClientDriveFolderName(input: BuildClientDriveFolderNameInput): string {
  const clientName = normalizeWhitespace(input.clientName)
  const ssnLast4 = normalizeWhitespace(input.ssnLast4)
  const state = normalizeClientDriveState(input.state)

  if (!clientName || !/^\d{4}$/.test(ssnLast4) || !/^[A-Z]{2}$/.test(state)) {
    throw new GoogleDriveServiceError('DRIVE_ROOT_INVALID', 'Invalid Drive folder naming input.')
  }

  if (input.businessMode === 'MULTI') {
    return `${clientName} ${ssnLast4} - ${state} - Multi`
  }

  const businessName = normalizeWhitespace(input.businessName ?? '')
  if (!businessName) {
    throw new GoogleDriveServiceError('DRIVE_ROOT_INVALID', 'Business name is required.')
  }

  return `${clientName} ${ssnLast4} - ${state} - ${businessName}`
}

export function getClientDriveDisplayName(input: {
  firstName: string
  lastName?: string | null
  name?: string | null
}): string {
  return normalizeWhitespace(
    input.name || [input.firstName, input.lastName].filter(Boolean).join(' ')
  )
}
