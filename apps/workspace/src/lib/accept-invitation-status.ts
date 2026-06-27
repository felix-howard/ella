type InvitationStatusInput = {
  ticket: string | null
  accountStatus: string | null
}

export function getCompletedInvitationRedirectTarget({
  ticket,
  accountStatus,
}: InvitationStatusInput): string | null {
  return ticket && accountStatus === 'complete' ? '/' : null
}
