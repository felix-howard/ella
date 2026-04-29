/**
 * Clerk Cleanup Script — Delete all users and orgs from App #1 Production
 *
 * Usage: npx tsx scripts/clerk-cleanup-staging.ts
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
  console.error('❌ CLERK_PROD_SECRET_KEY not found in .env.migration')
  process.exit(1)
}

const clerk = createClerkClient({ secretKey })

async function cleanup() {
  // Step 1: Delete all users
  console.log('=== DELETING ALL USERS ===\n')
  const users = await clerk.users.getUserList({ limit: 100 })
  for (const user of users.data) {
    try {
      await clerk.users.deleteUser(user.id)
      console.log(`✅ Deleted user: ${user.emailAddresses[0]?.emailAddress} (${user.id})`)
    } catch (error) {
      console.error(`❌ Failed to delete user ${user.id}:`, error)
    }
  }

  // Step 2: Delete all organizations
  console.log('\n=== DELETING ALL ORGANIZATIONS ===\n')
  const orgs = await clerk.organizations.getOrganizationList({ limit: 100 })
  for (const org of orgs.data) {
    try {
      await clerk.organizations.deleteOrganization(org.id)
      console.log(`✅ Deleted org: "${org.name}" (${org.id})`)
    } catch (error) {
      console.error(`❌ Failed to delete org ${org.id}:`, error)
    }
  }

  console.log('\n✅ Cleanup complete. Ready to re-run migration.')
}

cleanup().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
