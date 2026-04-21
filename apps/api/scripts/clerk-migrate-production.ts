/**
 * Clerk Migration Script — App #2 Production
 *
 * Creates organizations and users in App #2's Production instance,
 * then outputs SQL statements to update the production database.
 *
 * Usage: cd apps/api && npx tsx scripts/clerk-migrate-production.ts
 */

import { createClerkClient } from '@clerk/backend'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '..', '..', '..', '.env.migration')
const envContent = fs.readFileSync(envPath, 'utf-8')
const secretKey = envContent
  .split('\n')
  .find((line) => line.startsWith('CLERK_PROD_SECRET_KEY='))
  ?.split('=')[1]
  ?.trim()

if (!secretKey) {
  console.error('CLERK_PROD_SECRET_KEY not found in .env.migration')
  process.exit(1)
}

console.log(`Using secret key: ${secretKey.slice(0, 12)}...`)

const clerk = createClerkClient({ secretKey })

// ===== DATA FROM PRODUCTION DATABASE =====

const orgs = [
  { oldClerkOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP', name: 'Ella Team' },
]

const users = [
  {
    oldClerkId: 'user_39G1cfeehXmaHmq1jw5q1m2uCRe',
    email: 'andy19380@gmail.com',
    name: 'Andy Nguyen',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'ADMIN',
  },
  {
    oldClerkId: 'user_3B8Cv0BHvU0DBiWwlmLEB20LiyR',
    email: 'cntax8083@gmail.com',
    name: 'NANCY NGUYEN',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'ADMIN',
  },
  {
    oldClerkId: 'user_38FGglKpXJCh81RrrtMYMd0DT5Z',
    email: 'fuocy.huynh@gmail.com',
    name: 'Felix Howard',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'ADMIN',
  },
  {
    oldClerkId: 'user_3B946expuZVtG7e1vMfHzSgbeH2',
    email: 'j4nietr4n@gmail.com',
    name: 'Janie Tran',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
  {
    oldClerkId: 'user_39KBePDpwb65M6XdJgAKqtoJYo4',
    email: 'kaytax76@gmail.com',
    name: 'TUYET DUONG',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'ADMIN',
  },
  {
    oldClerkId: 'user_3B9508aIdRoy91zxn77RJ4PzopN',
    email: 'mrvu.shop90@gmail.com',
    name: 'Vu Nguyen',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
  {
    oldClerkId: 'user_39FzM8f9eyjDBUZmFP0zO5CdAPk',
    email: 'myalphamediateam3@gmail.com',
    name: 'Team 3 Chi',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
  {
    oldClerkId: 'user_3B94kJ5Qtk33f6SuoB7XqKBiRvo',
    email: 'nguyentrucn538@gmail.com',
    name: 'Truc Nguyen',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
  {
    oldClerkId: 'user_3B96agVgGJqjHYOgZP7YunaQjyf',
    email: 'tiffany@alphamedia.ai',
    name: 'Nghi La',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
  {
    oldClerkId: 'user_3B88536FbvuGinHHuKoAyjwKkje',
    email: 'tyger510@yahoo.com',
    name: 'Ty Nguyen',
    oldOrgId: 'org_399XloJ11DlisEIVSBJQ2HPGgAP',
    role: 'STAFF',
  },
]

async function migrate() {
  // Step 1: Create Organizations
  console.log('\n=== STEP 1: CREATE ORGANIZATIONS ===\n')
  const orgMapping: Record<string, string> = {}

  for (const org of orgs) {
    try {
      const newOrg = await clerk.organizations.createOrganization({
        name: org.name,
      })
      orgMapping[org.oldClerkOrgId] = newOrg.id
      console.log(`Org: "${org.name}" | OLD: ${org.oldClerkOrgId} -> NEW: ${newOrg.id}`)
    } catch (error) {
      console.error(`Failed to create org "${org.name}":`, error)
      process.exit(1)
    }
  }

  // Step 2: Create Users
  console.log('\n=== STEP 2: CREATE USERS ===\n')
  const userMapping: Record<string, string> = {}

  for (const user of users) {
    try {
      const nameParts = user.name.trim().split(/\s+/)
      const firstName = nameParts[0]
      const lastName = nameParts.slice(1).join(' ') || ''

      const newUser = await clerk.users.createUser({
        emailAddress: [user.email],
        firstName,
        lastName,
        skipPasswordRequirement: true,
      })

      const newOrgId = orgMapping[user.oldOrgId]
      if (newOrgId) {
        await clerk.organizations.createOrganizationMembership({
          organizationId: newOrgId,
          userId: newUser.id,
          role: user.role === 'ADMIN' ? 'org:admin' : 'org:member',
        })
        console.log(`User: ${user.email} (${user.role}) | OLD: ${user.oldClerkId} -> NEW: ${newUser.id}`)
      }

      userMapping[user.oldClerkId] = newUser.id
    } catch (error) {
      console.error(`Failed to create user "${user.email}":`, error)
      process.exit(1)
    }
  }

  // Step 3: Output SQL — all in one block including COMMIT
  console.log('\n=== SQL STATEMENTS (run in a SINGLE query tab on Supabase!) ===\n')
  console.log('BEGIN;')
  console.log('')
  console.log('-- Update Organizations')
  for (const [oldId, newId] of Object.entries(orgMapping)) {
    console.log(`UPDATE "Organization" SET "clerkOrgId" = '${newId}' WHERE "clerkOrgId" = '${oldId}';`)
  }
  console.log('')
  console.log('-- Update Staff')
  for (const [oldId, newId] of Object.entries(userMapping)) {
    console.log(`UPDATE "Staff" SET "clerkId" = '${newId}' WHERE "email" = (SELECT "email" FROM "Staff" WHERE "clerkId" = '${oldId}');`)
  }
  console.log('')
  console.log('COMMIT;')
  console.log('')
  console.log('-- Verify (runs after commit):')
  console.log(`SELECT 'ORGS' as "check", count(*) as "count" FROM "Organization"`)
  console.log(`UNION ALL`)
  console.log(`SELECT 'STAFF (active)', count(*) FROM "Staff" WHERE "isActive" = true`)
  console.log(`UNION ALL`)
  console.log(`SELECT 'STAFF (old clerkIds)', count(*) FROM "Staff" WHERE "clerkId" LIKE 'user_39%' OR "clerkId" LIKE 'user_3B8%' OR "clerkId" LIKE 'user_3B9%';`)

  // Save mappings
  const mappingPath = path.resolve(__dirname, '..', '..', '..', 'clerk-production-migration-mapping.json')
  fs.writeFileSync(
    mappingPath,
    JSON.stringify(
      {
        environment: 'production (App #2)',
        orgMapping,
        userMapping,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  )
  console.log(`\nMapping saved to ${mappingPath}`)
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
