import { StaffRole } from '@ella/db'
import { prisma } from '../../lib/db'

export type ClientMessagePushRecipients = {
  conversationId: string
  caseId: string
  clientId: string
  organizationId: string
  staffIds: string[]
}

export async function resolveClientMessagePushRecipients(
  conversationId: string
): Promise<ClientMessagePushRecipients | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: {
      id: true,
      caseId: true,
      taxCase: {
        select: {
          clientId: true,
          client: { select: { organizationId: true } },
        },
      },
    },
  })

  const clientId = conversation?.taxCase.clientId
  const organizationId = conversation?.taxCase.client.organizationId
  if (!conversation || !clientId || !organizationId) return null

  const staff = await prisma.staff.findMany({
    where: {
      organizationId,
      isActive: true,
      webPushSubscriptions: { some: { enabled: true } },
      OR: [
        { role: { in: [StaffRole.ADMIN, StaffRole.MANAGER] } },
        {
          managedClientLinks: {
            some: { clientId, organizationId },
          },
        },
      ],
    },
    select: { id: true },
  })

  return {
    conversationId: conversation.id,
    caseId: conversation.caseId,
    clientId,
    organizationId,
    staffIds: staff.map((staffMember) => staffMember.id),
  }
}
