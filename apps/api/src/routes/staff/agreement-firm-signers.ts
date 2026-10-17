/**
 * GET /staff/agreement-firm-signers
 *
 * Lists org staff who can counter-sign an agreement for the firm: active, with
 * a profile title and a saved signature. The send wizard lets the sender pick
 * one (e.g. an ops admin sending on behalf of the CPA); `snapshotFirmSide`
 * re-validates the chosen id server-side.
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'

export interface AgreementFirmSigner {
  id: string
  name: string
  title: string
}

/** Same eligibility rules `snapshotFirmSide` enforces at send time. */
export async function listAgreementFirmSigners(orgId: string): Promise<AgreementFirmSigner[]> {
  const staff = await prisma.staff.findMany({
    where: {
      organizationId: orgId,
      isActive: true,
      signaturePngKey: { not: null },
      title: { not: null },
    },
    select: { id: true, name: true, title: true },
    orderBy: { name: 'asc' },
  })
  return staff
    .filter((s) => s.title?.trim())
    .map((s) => ({ id: s.id, name: s.name, title: s.title!.trim() }))
}

export const agreementFirmSignersRoute = new Hono<{ Variables: AuthVariables }>()

agreementFirmSignersRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.staffId || !user?.organizationId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }
  return c.json({ data: await listAgreementFirmSigners(user.organizationId) })
})
