/**
 * One-time script to sync organization names from Clerk to DB
 *
 * Usage: cd apps/api && npx tsx scripts/sync-org-names-from-clerk.ts
 *
 * Requires CLERK_SECRET_KEY and DATABASE_URL in environment
 */
import { createClerkClient } from '@clerk/backend'
import { PrismaClient } from '@ella/db'

const secretKey = process.env.CLERK_SECRET_KEY
if (!secretKey) {
  console.error('CLERK_SECRET_KEY not set')
  process.exit(1)
}

const clerk = createClerkClient({ secretKey })
const prisma = new PrismaClient()

async function main() {
  // 1. Get all orgs from DB that have a clerkOrgId
  const dbOrgs = await prisma.organization.findMany({
    where: {},
    select: { id: true, clerkOrgId: true, name: true, slug: true, logoUrl: true },
  })

  console.log(`Found ${dbOrgs.length} organizations in DB`)

  for (const dbOrg of dbOrgs) {
    try {
      const clerkOrg = await clerk.organizations.getOrganization({
        organizationId: dbOrg.clerkOrgId!,
      })

      const updates: Record<string, string | null> = {}
      if (clerkOrg.name !== dbOrg.name) updates.name = clerkOrg.name
      if (clerkOrg.slug !== dbOrg.slug) updates.slug = clerkOrg.slug ?? null
      if (clerkOrg.imageUrl !== dbOrg.logoUrl) updates.logoUrl = clerkOrg.imageUrl ?? null

      if (Object.keys(updates).length > 0) {
        await prisma.organization.update({
          where: { id: dbOrg.id },
          data: updates,
        })
        console.log(
          `Updated "${dbOrg.name}" -> "${updates.name ?? dbOrg.name}" (clerk: ${dbOrg.clerkOrgId})`
        )
      } else {
        console.log(`"${dbOrg.name}" already in sync`)
      }
    } catch (err) {
      console.error(`Failed to sync org ${dbOrg.clerkOrgId}:`, err)
    }
  }

  console.log('Done!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
