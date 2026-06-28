import type { ApiError, AgreementPublicView } from '../../lib/api-client'
import type { AgreementErrorCode } from './agreement-error-panel'

type PortalApiError = Pick<ApiError, 'status' | 'code'>
type PortalAgreementApiError = PortalApiError & Pick<ApiError, 'documentLabel'>

const AGREEMENT_ERROR_CODE_MAP: Partial<Record<string, AgreementErrorCode>> = {
  AGREEMENT_VOIDED: 'voided',
  AGREEMENT_SIGNED: 'signed',
  AGREEMENT_INACTIVE: 'invalid',
}

function isApiError(err: unknown): err is PortalApiError {
  return (
    err instanceof Error &&
    err.name === 'ApiError' &&
    typeof (err as Partial<PortalApiError>).status === 'number' &&
    typeof (err as Partial<PortalApiError>).code === 'string'
  )
}

function isAgreementApiError(err: unknown): err is PortalAgreementApiError {
  return isApiError(err) && 'documentLabel' in err
}

function mapAgreementApiCode(code: string): AgreementErrorCode | null {
  return AGREEMENT_ERROR_CODE_MAP[code] ?? null
}

export function getAgreementDocumentLabel(view: AgreementPublicView | null | undefined): string {
  return view?.templateTitle.trim() || 'agreement'
}

export function getAgreementErrorDocumentLabel(err: unknown): string | undefined {
  if (!isAgreementApiError(err)) return undefined

  return err.documentLabel?.trim() || undefined
}

export function mapLoadError(err: unknown): AgreementErrorCode {
  if (!isApiError(err)) return 'server'

  const codeError = mapAgreementApiCode(err.code)
  if (codeError) return codeError

  if (err.status === 404) return 'invalid'
  if (err.status === 410) return 'expired'
  if (err.status === 409) return 'signed'
  if (err.status === 429) return 'rate_limited'
  return 'server'
}

export function mapSignError(err: unknown): AgreementErrorCode {
  if (!isApiError(err)) return 'server'

  const codeError = mapAgreementApiCode(err.code)
  if (codeError) return codeError

  if (err.status === 409) return 'signed'
  if (err.status === 410) return 'expired'
  if (err.status === 429) return 'rate_limited'
  if (err.status === 404) return 'invalid'
  return 'server'
}

export function deriveStatusError(view: AgreementPublicView): AgreementErrorCode | null {
  if (view.expired) return 'expired'
  if (view.status === 'SIGNED') return 'signed'
  if (view.status === 'VOIDED') return 'voided'
  if (view.status !== 'SENT') return 'invalid'
  return null
}
