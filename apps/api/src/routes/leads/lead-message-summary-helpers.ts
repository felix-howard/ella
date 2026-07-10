import { Prisma } from '@ella/db'
import { prisma } from '../../lib/db'

export function toSafeLeadMessageCount(value: bigint | number | null | undefined): number {
  return Math.min(Number(value ?? 0), 9999)
}

export async function getUnreadLeadMessageCounts(leadIds: string[]): Promise<Map<string, number>> {
  if (leadIds.length === 0) return new Map()

  const rows = await prisma.$queryRaw<Array<{ leadId: string; unreadCount: bigint }>>`
    SELECT
      l.id as "leadId",
      COUNT(m.id) FILTER (
        WHERE m.direction = 'INBOUND'
          AND (l."messagesLastReadAt" IS NULL OR m."createdAt" > l."messagesLastReadAt")
      ) as "unreadCount"
    FROM "Lead" l
    LEFT JOIN "Message" m ON m."leadId" = l.id
    WHERE l.id IN (${Prisma.join(leadIds)})
    GROUP BY l.id
  `

  return new Map(rows.map((row) => [row.leadId, toSafeLeadMessageCount(row.unreadCount)]))
}

export async function getActiveLeadUnreadMessageTotal(organizationId: string): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ totalUnread: bigint }>>`
    SELECT COUNT(m.id) as "totalUnread"
    FROM "Lead" l
    INNER JOIN "Message" m ON m."leadId" = l.id
    WHERE l."organizationId" = ${organizationId}
      AND l.status != 'CONVERTED'
      AND m.direction = 'INBOUND'
      AND (l."messagesLastReadAt" IS NULL OR m."createdAt" > l."messagesLastReadAt")
  `

  return toSafeLeadMessageCount(rows[0]?.totalUnread)
}
