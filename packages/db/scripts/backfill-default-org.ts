/**
 * Backfill default Organization for existing Staff + Client records.
 * Phase 1 of Multi-Tenancy & Permission migration.
 *
 * Usage:
 *   pnpm -F @ella/db backfill:default-org           # Execute backfill
 *   DRY_RUN=1 pnpm -F @ella/db backfill:default-org # Preview only (no writes)
 *
 * Requires env vars:
 *   CLERK_ORG_ID   - Clerk organization ID (e.g. org_xxx)
 *   CLERK_ORG_NAME - Organization display name (e.g. "My CPA Office")
 *   CLERK_ORG_SLUG - (optional) Organization slug
 *   DRY_RUN        - (optional) Set to "1" to preview without writing
 */

import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()
const isDryRun = process.env.DRY_RUN === '1'

async function backfillDefaultOrg() {
  const clerkOrgId = process.env.CLERK_ORG_ID
  const orgName = process.env.CLERK_ORG_NAME

  if (!clerkOrgId || !orgName) {
    console.error('[Backfill] Missing required env vars: CLERK_ORG_ID, CLERK_ORG_NAME')
    process.exit(1)
  }

  const orgSlug = process.env.CLERK_ORG_SLUG || null

  console.log(`[Backfill] Mode: ${isDryRun ? 'DRY RUN (no writes)' : 'LIVE'}`)
  console.log('[Backfill] Timestamp:', new Date().toISOString())
  console.log('[Backfill] Clerk Org ID:', clerkOrgId)
  console.log('[Backfill] Org Name:', orgName)

  if (isDryRun) {
    // Preview: count records that would be affected
    const staffCount = await prisma.staff.count({ where: { organizationId: null } })
    const clientCount = await prisma.client.count({ where: { organizationId: null } })
    const existingOrg = await prisma.organization.findUnique({ where: { clerkOrgId } })

    console.log(`[Backfill] Organization: ${existingOrg ? `exists (${existingOrg.id})` : 'will be created'}`)
    console.log(`[Backfill] Staff to update: ${staffCount}`)
    console.log(`[Backfill] Clients to update: ${clientCount}`)
    console.log('[Backfill] DRY RUN complete - no changes made')
    return
  }

  // Wrap all writes in a transaction for atomicity
  const result = await prisma.$transaction(async (tx) => {
    // Step 1: Upsert the default Organization
    const org = await tx.organization.upsert({
      where: { clerkOrgId },
      create: { clerkOrgId, name: orgName, slug: orgSlug },
      update: { name: orgName, slug: orgSlug },
    })
    console.log(`[Backfill] Organization ready: ${org.id} (${org.name})`)

    // Step 2: Update Staff records without organizationId
    const staffResult = await tx.staff.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id },
    })
    console.log(`[Backfill] Staff updated: ${staffResult.count}`)

    // Step 3: Update Client records without organizationId
    const clientResult = await tx.client.updateMany({
      where: { organizationId: null },
      data: { organizationId: org.id },
    })
    console.log(`[Backfill] Clients updated: ${clientResult.count}`)

    return { orgId: org.id, staff: staffResult.count, clients: clientResult.count }
  })

  console.log('[Backfill] Done!')
  console.log(`[Backfill] Summary: org=${result.orgId}, staff=${result.staff}, clients=${result.clients}`)
}

backfillDefaultOrg()
  .catch((e) => {
    console.error('[Backfill] Fatal error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
