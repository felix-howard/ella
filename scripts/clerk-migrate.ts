/**
 * Clerk User Migration Script
 * Migrates users and organizations from App #1 (Dev) to a target Clerk app (Staging or Production).
 *
 * Usage:
 *   # Test on staging first (App #1 Production mode):
 *   TARGET_CLERK_SECRET_KEY=sk_live_yyyyy npx dotenv -e .env -- tsx scripts/clerk-migrate.ts
 *
 *   # Then production (App #2 Production mode):
 *   TARGET_CLERK_SECRET_KEY=sk_live_xxxxx npx dotenv -e .env -- tsx scripts/clerk-migrate.ts
 *
 * What it does:
 *   1. Reads current Staff + Organization data from your database
 *   2. Creates organizations in the TARGET Clerk app
 *   3. Creates users WITHOUT passwords (they must use "Forgot Password" on first login)
 *   4. Adds users to organizations with correct roles
 *   5. Outputs SQL statements to update database clerkId/clerkOrgId mappings
 *   6. Saves mapping to clerk-migration-mapping.json
 *
 * IMPORTANT: Run this BEFORE updating Railway env vars. The SQL update is a separate manual step.
 */

import { createClerkClient } from '@clerk/backend'
import { PrismaClient } from '../packages/db/src/generated/index.js'

// ─── Configuration ───────────────────────────────────────────────────────────

const TARGET_CLERK_SECRET_KEY = process.env.TARGET_CLERK_SECRET_KEY
if (!TARGET_CLERK_SECRET_KEY) {
  console.error('ERROR: TARGET_CLERK_SECRET_KEY environment variable is required.')
  console.error('Usage: TARGET_CLERK_SECRET_KEY=sk_live_xxx npx dotenv -e .env -- tsx scripts/clerk-migrate.ts')
  process.exit(1)
}

const targetClerk = createClerkClient({ secretKey: TARGET_CLERK_SECRET_KEY })
const prisma = new PrismaClient()

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrgData {
  id: string
  clerkOrgId: string
  name: string
  slug: string | null
}

interface StaffData {
  id: string
  clerkId: string | null
  email: string
  firstName: string
  lastName: string
  role: string
  organizationId: string
  orgClerkOrgId: string
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║           CLERK USER MIGRATION SCRIPT                      ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()

  // ── Step 1: Read current data from database ──────────────────────────────

  console.log('=== STEP 1: Reading current data from database ===')
  console.log()

  const organizations: OrgData[] = await prisma.$queryRaw`
    SELECT o."id", o."clerkOrgId", o."name", o."slug"
    FROM "Organization" o
    ORDER BY o."name"
  `

  const staff: StaffData[] = await prisma.$queryRaw`
    SELECT
      s."id",
      s."clerkId",
      s."email",
      s."firstName",
      s."lastName",
      s."role",
      s."organizationId",
      o."clerkOrgId" as "orgClerkOrgId"
    FROM "Staff" s
    JOIN "Organization" o ON s."organizationId" = o."id"
    WHERE s."isActive" = true
    ORDER BY o."name", s."email"
  `

  console.log(`Found ${organizations.length} organization(s):`)
  for (const org of organizations) {
    console.log(`  - ${org.name} (clerkOrgId: ${org.clerkOrgId})`)
  }
  console.log()
  console.log(`Found ${staff.length} active staff member(s):`)
  for (const s of staff) {
    console.log(`  - ${s.email} (${s.role}) [clerkId: ${s.clerkId}]`)
  }
  console.log()

  if (organizations.length === 0 || staff.length === 0) {
    console.error('ERROR: No organizations or staff found. Check your DATABASE_URL.')
    process.exit(1)
  }

  // ── Step 2: Create Organizations in target Clerk app ─────────────────────

  console.log('=== STEP 2: Creating organizations in target Clerk app ===')
  console.log()

  const orgMapping: Record<string, string> = {} // old clerkOrgId -> new clerkOrgId

  for (const org of organizations) {
    try {
      const newOrg = await targetClerk.organizations.createOrganization({
        name: org.name,
        slug: org.slug || undefined,
      })
      orgMapping[org.clerkOrgId] = newOrg.id
      console.log(`  OK  Org: "${org.name}"`)
      console.log(`       OLD: ${org.clerkOrgId}`)
      console.log(`       NEW: ${newOrg.id}`)
      console.log()
    } catch (error) {
      console.error(`  FAIL  Org "${org.name}":`, error)
      process.exit(1)
    }
  }

  // ── Step 3: Create Users in target Clerk app (NO password) ───────────────

  console.log('=== STEP 3: Creating users in target Clerk app (no password) ===')
  console.log('Users will need to use "Forgot Password" on first login.')
  console.log()

  const userMapping: Record<string, string> = {} // old clerkId -> new clerkId

  for (const s of staff) {
    if (!s.clerkId) {
      console.log(`  SKIP  ${s.email} — no clerkId in database`)
      continue
    }

    try {
      // Create user WITHOUT password — they must use "Forgot Password" to set one
      const newUser = await targetClerk.users.createUser({
        emailAddress: [s.email],
        firstName: s.firstName,
        lastName: s.lastName,
        skipPasswordRequirement: true,
      })

      // Add to organization with correct role
      const newOrgId = orgMapping[s.orgClerkOrgId]
      if (newOrgId) {
        await targetClerk.organizations.createOrganizationMembership({
          organizationId: newOrgId,
          userId: newUser.id,
          role: s.role === 'ADMIN' ? 'org:admin' : 'org:member',
        })
      }

      userMapping[s.clerkId] = newUser.id
      console.log(`  OK  User: ${s.email} (${s.role})`)
      console.log(`       OLD: ${s.clerkId}`)
      console.log(`       NEW: ${newUser.id}`)
      console.log(`       Org: ${newOrgId || 'NONE'}`)
      console.log()
    } catch (error) {
      console.error(`  FAIL  User "${s.email}":`, error)
      process.exit(1)
    }
  }

  // ── Step 4: Output SQL statements ────────────────────────────────────────

  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║    SQL STATEMENTS — Copy and run on your database           ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log()
  console.log('BEGIN;')
  console.log()

  console.log('-- Update Organizations')
  for (const [oldId, newId] of Object.entries(orgMapping)) {
    console.log(`UPDATE "Organization" SET "clerkOrgId" = '${newId}' WHERE "clerkOrgId" = '${oldId}';`)
  }
  console.log()

  console.log('-- Update Staff')
  for (const [oldId, newId] of Object.entries(userMapping)) {
    console.log(`UPDATE "Staff" SET "clerkId" = '${newId}' WHERE "clerkId" = '${oldId}';`)
  }
  console.log()

  console.log('-- Verify before committing:')
  console.log('SELECT s."email", s."clerkId", s."role", o."name", o."clerkOrgId"')
  console.log('FROM "Staff" s')
  console.log('JOIN "Organization" o ON s."organizationId" = o."id"')
  console.log('WHERE s."isActive" = true')
  console.log('ORDER BY o."name", s."email";')
  console.log()
  console.log('-- If everything looks correct: COMMIT;')
  console.log('-- If ANYTHING looks wrong:     ROLLBACK;')
  console.log()

  // ── Step 5: Save mapping to file ─────────────────────────────────────────

  const fs = await import('fs')
  const mappingData = {
    orgMapping,
    userMapping,
    timestamp: new Date().toISOString(),
    targetKey: TARGET_CLERK_SECRET_KEY.slice(0, 12) + '...',
    stats: {
      organizations: organizations.length,
      users: staff.length,
      usersSkipped: staff.filter(s => !s.clerkId).length,
    },
  }

  fs.writeFileSync('clerk-migration-mapping.json', JSON.stringify(mappingData, null, 2))
  console.log('Mapping saved to clerk-migration-mapping.json')
  console.log()

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('=== SUMMARY ===')
  console.log(`  Organizations created: ${Object.keys(orgMapping).length}`)
  console.log(`  Users created:         ${Object.keys(userMapping).length}`)
  console.log(`  Users skipped:         ${staff.filter(s => !s.clerkId).length}`)
  console.log()
  console.log('NEXT STEPS:')
  console.log('  1. Run the SQL statements above on your database (inside a transaction)')
  console.log('  2. Verify the SELECT output matches the mappings')
  console.log('  3. COMMIT if correct, ROLLBACK if wrong')
  console.log('  4. Update Railway env vars to point to the new Clerk app keys')
  console.log('  5. Tell users to use "Forgot Password" on the login page to set their password')
  console.log()

  await prisma.$disconnect()
}

main().catch(async (error) => {
  console.error('Migration failed:', error)
  await prisma.$disconnect()
  process.exit(1)
})
