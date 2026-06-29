/**
 * Server-side read-time redaction for automated payment/agreement SMS content.
 *
 * Raw Message rows remain unchanged. Apply this helper only while building
 * Workspace-facing responses; portal/client-owned routes are out of scope.
 */
import type { AuthUser } from '../services/auth'

export type RedactedMessageKind =
  | 'payment_link'
  | 'payment_confirmation'
  | 'agreement_link'

export type SensitiveMessageLike = {
  direction?: string | null
  content?: string | null
  templateUsed?: string | null
  staffAuthoredContent?: string | null
}

const TEMPLATE_REDACTION_KIND: Record<string, RedactedMessageKind> = {
  quote_pay_link: 'payment_link',
  deposit_pay_link: 'payment_link',
  quote_receipt: 'payment_confirmation',
  deposit_receipt: 'payment_confirmation',
  agreement_invite: 'agreement_link',
}

const REDACTION_PLACEHOLDERS: Record<RedactedMessageKind, string> = {
  payment_link: 'A payment link was sent to the client.',
  payment_confirmation: 'A payment confirmation was sent to the client.',
  agreement_link: 'An agreement link was sent to the client.',
}

const ABSOLUTE_URL_PATTERN = /https?:\/\/[^\s"'<>]+/gi
const RELATIVE_PORTAL_PATH_PATTERN = /(?:^|[\s("'`])\/(?:quote|pay|agreements)\/[^\s"'<>)]*/gi
const DEFAULT_PORTAL_URL = 'http://localhost:5173'
const BUILT_IN_PORTAL_HOSTS = new Set(['my.ella.tax', 'portal.ellatax.com'])

/** ADMIN tier only — mirrors phone privacy's admin-only read rule. */
export function canViewSensitiveMessageContent(user: AuthUser): boolean {
  return user.orgRole === 'org:admin' || user.role === 'ADMIN'
}

export function getSensitiveMessagePlaceholder(kind: RedactedMessageKind): string {
  return REDACTION_PLACEHOLDERS[kind]
}

export function getSensitiveMessageRedactionKind(
  message: SensitiveMessageLike,
): RedactedMessageKind | null {
  if (message.direction !== 'OUTBOUND') return null

  const templateKind = getTemplateRedactionKind(message.templateUsed)
  if (templateKind) return templateKind

  return getSensitiveUrlRedactionKind(message.content)
}

export function serializeSensitiveMessageText<T extends SensitiveMessageLike>(
  user: AuthUser,
  message: T,
): T {
  const kind = getSensitiveMessageRedactionKind(message)
  if (!kind || canViewSensitiveMessageContent(user)) return message

  const redacted = {
    ...message,
    content: getSensitiveMessagePlaceholder(kind),
  }

  if ('staffAuthoredContent' in redacted) {
    return { ...redacted, staffAuthoredContent: null } as T
  }

  return redacted as T
}

function getTemplateRedactionKind(templateUsed?: string | null): RedactedMessageKind | null {
  if (!templateUsed) return null
  return TEMPLATE_REDACTION_KIND[templateUsed] ?? null
}

function getSensitiveUrlRedactionKind(content?: string | null): RedactedMessageKind | null {
  if (!content) return null

  for (const rawUrl of content.matchAll(ABSOLUTE_URL_PATTERN)) {
    const kind = getAbsoluteUrlRedactionKind(rawUrl[0])
    if (kind) return kind
  }

  for (const rawPath of content.matchAll(RELATIVE_PORTAL_PATH_PATTERN)) {
    const kind = getPortalPathRedactionKind(rawPath[0].trim())
    if (kind) return kind
  }

  return null
}

function getAbsoluteUrlRedactionKind(rawUrl: string): RedactedMessageKind | null {
  try {
    const url = new URL(rawUrl)
    if (!isAllowedPortalHost(url.hostname)) return null
    return getPortalPathRedactionKind(url.pathname)
  } catch {
    return null
  }
}

function getPortalPathRedactionKind(path: string): RedactedMessageKind | null {
  if (path.includes('/quote/') || path.includes('/pay/')) return 'payment_link'
  if (path.includes('/agreements/')) return 'agreement_link'
  return null
}

function isAllowedPortalHost(hostname: string): boolean {
  const normalizedHost = hostname.toLowerCase()
  if (BUILT_IN_PORTAL_HOSTS.has(normalizedHost)) return true

  const portalHost = getConfiguredPortalHost()
  return Boolean(portalHost && normalizedHost === portalHost)
}

function getConfiguredPortalHost(): string | null {
  try {
    return new URL(process.env.PORTAL_URL || DEFAULT_PORTAL_URL).hostname.toLowerCase()
  } catch {
    return null
  }
}
