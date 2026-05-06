/**
 * GET /staff/me/nda-readiness
 *
 * Returns whether the current staff + their organization have all data needed
 * to send a v2 NDA: per-staff signature PNG and title, plus org-level firm
 * address and governing law. Wizard pre-flight gate consumes this to block
 * sending until setup is complete.
 */
import { Hono } from 'hono'
import { prisma } from '../../lib/db'
import type { AuthVariables } from '../../middleware/auth'

export type NdaReadinessMissing = 'signature' | 'title' | 'orgAddress' | 'orgGoverningLaw'

export interface NdaReadinessResponse {
  ready: boolean
  missing: NdaReadinessMissing[]
}

export const ndaReadinessRoute = new Hono<{ Variables: AuthVariables }>()

ndaReadinessRoute.get('/', async (c) => {
  const user = c.get('user')
  if (!user?.staffId || !user?.organizationId) {
    return c.json({ error: 'Staff record not found' }, 404)
  }

  const [staff, org] = await Promise.all([
    prisma.staff.findUnique({
      where: { id: user.staffId },
      select: { signaturePngKey: true, title: true },
    }),
    prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: {
        address: true,
        city: true,
        state: true,
        zip: true,
        governingState: true,
        governingCounty: true,
      },
    }),
  ])

  if (!staff || !org) {
    return c.json({ error: 'Staff or organization not found' }, 404)
  }

  const missing: NdaReadinessMissing[] = []
  if (!staff.signaturePngKey) missing.push('signature')
  if (!staff.title?.trim()) missing.push('title')
  if (!org.address?.trim() || !org.city?.trim() || !org.state?.trim() || !org.zip?.trim()) {
    missing.push('orgAddress')
  }
  if (!org.governingState?.trim() || !org.governingCounty?.trim()) {
    missing.push('orgGoverningLaw')
  }

  const body: NdaReadinessResponse = { ready: missing.length === 0, missing }
  return c.json(body)
})
