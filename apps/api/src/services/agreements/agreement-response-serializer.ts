import type { Prisma } from '@ella/db'
export const agreementStaffSummarySelect = {
  id: true,
  name: true,
  email: true,
} satisfies Prisma.StaffSelect

export const agreementResponseInclude = {
  createdBy: { select: agreementStaffSummarySelect },
  lastEditedBy: { select: agreementStaffSummarySelect },
  sentBy: { select: agreementStaffSummarySelect },
  voidedBy: { select: agreementStaffSummarySelect },
} satisfies Prisma.AgreementInclude

export type AgreementStaffSummary = Prisma.StaffGetPayload<{
  select: typeof agreementStaffSummarySelect
}>

export type AgreementWithResponseRelations = Prisma.AgreementGetPayload<{
  include: typeof agreementResponseInclude
}>

export type AgreementResponse = Omit<AgreementWithResponseRelations, 'token'> & {
  token?: string
  url?: string
}

export function stripAgreementToken<T extends { token?: unknown }>(agreement: T): Omit<T, 'token'> {
  const { token: _token, ...response } = agreement
  void _token
  return response
}

export function serializeAgreementResponse(agreement: AgreementWithResponseRelations): AgreementResponse {
  return stripAgreementToken(agreement)
}
