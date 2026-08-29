export const CLIENT_DRIVE_FOLDER_ROLES = {
  CLIENT_ROOT: 'CLIENT_ROOT',
  AM_WORK: 'AM_WORK',
  OFFICE_ADMIN_ONLY: 'OFFICE_ADMIN_ONLY',
  OFFICE_ADMIN_DOCS: 'OFFICE_ADMIN_DOCS',
  OFFICE_LLC_DOCS: 'OFFICE_LLC_DOCS',
  SHARED_TO_CLIENT: 'SHARED_TO_CLIENT',
  SHARED_TAX_DOCS: 'SHARED_TAX_DOCS',
  SHARED_PAYSTUBS: 'SHARED_PAYSTUBS',
  SHARED_RECEIPTS: 'SHARED_RECEIPTS',
  SHARED_STATEMENTS: 'SHARED_STATEMENTS',
  SHARED_CASH_PLAN: 'SHARED_CASH_PLAN',
  BUSINESS_ROOT: 'BUSINESS_ROOT',
  BUSINESS_CASH_PLAN: 'BUSINESS_CASH_PLAN',
  BUSINESS_OTHER_DOCS: 'BUSINESS_OTHER_DOCS',
} as const

export type ClientDriveFolderRole =
  (typeof CLIENT_DRIVE_FOLDER_ROLES)[keyof typeof CLIENT_DRIVE_FOLDER_ROLES]

export const CLIENT_DRIVE_FOLDER_NAMES = {
  AM_WORK: 'AM WORK',
  OFFICE_ADMIN_ONLY: 'OFFICE - ADMIN ONLY',
  OFFICE_ADMIN_DOCS: 'ADMIN Docs',
  OFFICE_LLC_DOCS: 'LLC Docs',
  SHARED_TO_CLIENT: 'SHARED TO CLIENT',
} as const

// The SHARED TO CLIENT folder name carries the client's display name and last 4
// SSN digits so staff can identify the shared folder at a glance, e.g.
// "SHARED TO CLIENT-Chaoyang You 7863". Falls back to the bare base name when
// either part is missing so we never emit a dangling separator.
export function getClientDriveSharedToClientFolderName(
  clientName: string,
  ssnLast4: string | null
): string {
  const name = clientName.trim().replace(/\s+/g, ' ')
  const ssn = (ssnLast4 ?? '').trim()
  const suffix = [name, ssn].filter(Boolean).join(' ')
  if (!suffix) return CLIENT_DRIVE_FOLDER_NAMES.SHARED_TO_CLIENT
  return `${CLIENT_DRIVE_FOLDER_NAMES.SHARED_TO_CLIENT}-${suffix}`
}

export function getClientDriveSharedTaxDocsFolderName(year: number): string {
  return `${year} TAX DOCS`
}

export function getClientDriveSharedPaystubsFolderName(year: number): string {
  return `${year}-Paystubs`
}

export function getClientDriveSharedReceiptsFolderName(year: number): string {
  return `${year}-Receipts`
}

export function getClientDriveSharedStatementsFolderName(year: number): string {
  return `${year}-Statements`
}

export function getClientDriveSharedCashPlanFolderName(year: number): string {
  return `${year}-Cash Plan`
}

export function getClientDriveBusinessCashPlanFolderName(year: number): string {
  return `${year}-Cash plan`
}

export function getClientDriveBusinessOtherDocsFolderName(year: number): string {
  return `${year}-Other Docs`
}
