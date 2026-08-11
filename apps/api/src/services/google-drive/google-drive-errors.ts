export type GoogleDriveErrorCode =
  | 'DRIVE_NOT_CONNECTED'
  | 'DRIVE_ROOT_INVALID'
  | 'DRIVE_PERMISSION_FAILED'
  | 'DRIVE_RATE_LIMITED'
  | 'DRIVE_AUTH_EXPIRED'
  | 'DRIVE_STRUCTURE_IN_PROGRESS'

const PUBLIC_MESSAGES: Record<GoogleDriveErrorCode, string> = {
  DRIVE_NOT_CONNECTED: 'Google Drive is not connected.',
  DRIVE_ROOT_INVALID: 'Google Drive root folder is invalid or unavailable.',
  DRIVE_PERMISSION_FAILED: 'Google Drive permission update failed.',
  DRIVE_RATE_LIMITED: 'Google Drive rate limit exceeded. Try again later.',
  DRIVE_AUTH_EXPIRED: 'Google Drive authorization expired. Reconnect Drive.',
  DRIVE_STRUCTURE_IN_PROGRESS: 'Google Drive folder structure creation is already in progress.',
}

export class GoogleDriveServiceError extends Error {
  constructor(
    readonly code: GoogleDriveErrorCode,
    message = PUBLIC_MESSAGES[code],
    readonly cause?: unknown
  ) {
    super(message)
    this.name = 'GoogleDriveServiceError'
  }
}

function getErrorStatus(error: unknown): number | null {
  const candidate = error as {
    code?: unknown
    status?: unknown
    response?: { status?: unknown }
  }
  const status = candidate.response?.status ?? candidate.status ?? candidate.code
  return typeof status === 'number' ? status : null
}

function getErrorText(error: unknown): string {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return ''
}

export function normalizeGoogleDriveError(
  error: unknown,
  fallbackCode: GoogleDriveErrorCode
): GoogleDriveServiceError {
  if (error instanceof GoogleDriveServiceError) return error

  const status = getErrorStatus(error)
  const text = getErrorText(error)

  if (status === 401 || /invalid_grant|invalid[_ ]token|unauthorized/i.test(text)) {
    return new GoogleDriveServiceError('DRIVE_AUTH_EXPIRED', undefined, error)
  }

  if (status === 429 || /rate.?limit|quota|too many requests/i.test(text)) {
    return new GoogleDriveServiceError('DRIVE_RATE_LIMITED', undefined, error)
  }

  return new GoogleDriveServiceError(fallbackCode, undefined, error)
}
