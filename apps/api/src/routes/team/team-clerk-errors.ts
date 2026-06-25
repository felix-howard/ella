type ClerkErrorSummary = {
  status?: number
  code?: string
  message: string
}

type PublicClerkError = Pick<ClerkErrorSummary, 'status' | 'code'>

function extractClerkErrorStatus(error: unknown): number | undefined {
  const record = error as { status?: unknown; statusCode?: unknown; status_code?: unknown }
  const status = record.status ?? record.statusCode ?? record.status_code
  return typeof status === 'number' ? status : undefined
}

export function describeClerkError(error: unknown): ClerkErrorSummary {
  const record = error as {
    errors?: Array<{ code?: string; message?: string; longMessage?: string }>
    message?: string
  }
  const first = record.errors?.[0]
  return {
    status: extractClerkErrorStatus(error),
    code: first?.code,
    message: first?.longMessage || first?.message || record.message || 'Clerk request failed',
  }
}

export function publicClerkError(error: unknown): PublicClerkError {
  const summary = describeClerkError(error)
  return {
    status: summary.status,
    code: summary.code,
  }
}

export function isClerkMembershipNotFoundError(error: unknown): boolean {
  const summary = describeClerkError(error)
  const haystack = `${summary.code ?? ''} ${summary.message}`.toLowerCase()
  return summary.status === 404 && (
    haystack.includes('membership') ||
    haystack.includes('resource_not_found') ||
    haystack.includes('not found')
  )
}

export function clerkFailureHttpStatus(error: unknown): 400 | 429 | 502 {
  const status = extractClerkErrorStatus(error)
  if (status === 429) return 429
  if (!status || status >= 500) return 502
  return 400
}
