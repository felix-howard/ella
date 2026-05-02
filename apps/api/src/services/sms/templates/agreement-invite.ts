/**
 * Generic Agreement Invite SMS Template
 *
 * Sent when staff dispatches a signing link for any agreement type (NDA,
 * Engagement Letter, Service Agreement, Custom). The agreement title is
 * interpolated verbatim so a staff-set title (e.g. "Engagement Letter 2025")
 * appears in the recipient's SMS body.
 *
 * Segment cost notes:
 * - EN (GSM-7, 160 chars/seg): typical titles ("NDA", "Engagement Letter
 *   2025") fit in 1 segment. Long custom titles + long org names can push to
 *   2 segments — accepted trade-off for v1 flexibility.
 * - VI (UCS-2, 70 chars/seg): Vietnamese diacritics force UCS-2 encoding, so
 *   the typical message lands in ~3 segments. Accepted trade-off until
 *   per-org language resolution lets us short-circuit non-VI orgs.
 */

export interface AgreementInviteTemplateParams {
  firstName: string
  title: string
  orgName: string
  url: string
  language: 'VI' | 'EN'
}

const TEMPLATES = {
  VI: (params: AgreementInviteTemplateParams) =>
    `Chào ${params.firstName}, vui lòng xem và ký ${params.title} từ ${params.orgName}: ${params.url}
Liên kết có hiệu lực 7 ngày. Soạn HELP để được hỗ trợ.`,

  EN: (params: AgreementInviteTemplateParams) =>
    `Hi ${params.firstName}, please review and sign the ${params.title} from ${params.orgName}: ${params.url}
Valid for 7 days. Reply HELP for assistance.`,
}

export function generateAgreementInviteMessage(
  params: AgreementInviteTemplateParams,
): string {
  const template = TEMPLATES[params.language] || TEMPLATES.EN
  return template(params)
}

export const AGREEMENT_INVITE_TEMPLATE_NAME = 'agreement_invite' as const
