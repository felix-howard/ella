/**
 * Data Migration: Business → Client (BUSINESS type) records
 *
 * Converts existing Business records into top-level Client records with
 * clientType=BUSINESS, creates ClientGroups linking owner ↔ business,
 * and backfills clientId FK on Contractor/FilingBatch/ContractorIntakeToken.
 *
 * Usage: cd apps/api && npx tsx scripts/migrate-business-to-client.ts [options]
 *
 * Options:
 *   --dry-run       Print what would happen without executing
 *   --confirm       Required for live mode (safety guard)
 *   --org-id <id>   Migrate only businesses belonging to this org (for testing)
 */
import { PrismaClient } from '@ella/db'

const prisma = new PrismaClient()

// Parse CLI flags
const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const confirm = args.includes('--confirm')
const orgIdIndex = args.indexOf('--org-id')
const orgIdFilter = orgIdIndex !== -1 ? args[orgIdIndex + 1] : undefined

interface MigrationStats {
  total: number
  migrated: number
  skipped: number
  errors: number
  contractorsUpdated: number
  filingBatchesUpdated: number
  intakeTokensUpdated: number
  groupsCreated: number
}

async function main() {
  // Safety: require --confirm for live mode
  if (!dryRun && !confirm) {
    console.error('ERROR: Live mode requires --confirm flag.')
    console.error('Run with --dry-run first, then --confirm to execute.')
    process.exit(1)
  }

  const stats: MigrationStats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    contractorsUpdated: 0,
    filingBatchesUpdated: 0,
    intakeTokensUpdated: 0,
    groupsCreated: 0,
  }

  console.log('=== Business → Client Migration ===')
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  if (orgIdFilter) console.log(`Org filter: ${orgIdFilter}`)
  console.log('')

  // Build where clause for Business query
  const businessWhere = orgIdFilter
    ? { client: { organizationId: orgIdFilter } }
    : {}

  const businesses = await prisma.business.findMany({
    where: businessWhere,
    include: {
      client: true,
      contractors: { select: { id: true } },
      filingBatches: { select: { id: true } },
      intakeTokens: { select: { id: true } },
    },
  })

  stats.total = businesses.length
  console.log(`Found ${stats.total} Business records to process\n`)

  for (const business of businesses) {
    const ownerName = `${business.client.firstName} ${business.client.lastName || ''}`.trim()
    const logPrefix = `[${business.name}] (owner: ${ownerName})`
    // Deterministic phone for this business — used for both idempotency and creation
    const bizPhone = `biz-${business.id}`

    try {
      // Idempotency check: match on deterministic phone (unique per source business)
      const existing = await prisma.client.findFirst({
        where: { phone: bizPhone },
      })

      if (existing) {
        console.log(`${logPrefix} SKIP — already migrated (client ${existing.id})`)
        stats.skipped++
        continue
      }

      const contractorCount = business.contractors.length
      const batchCount = business.filingBatches.length
      const tokenCount = business.intakeTokens.length

      if (dryRun) {
        console.log(`${logPrefix} WOULD migrate:`)
        console.log(`  - Create BUSINESS client (phone: ${bizPhone})`)
        console.log(`  - Create/reuse ClientGroup "${ownerName} Group"`)
        console.log(`  - Link owner ${business.client.id} to group`)
        console.log(`  - Update ${contractorCount} contractors, ${batchCount} batches, ${tokenCount} tokens`)
        stats.migrated++
        stats.contractorsUpdated += contractorCount
        stats.filingBatchesUpdated += batchCount
        stats.intakeTokensUpdated += tokenCount
        continue
      }

      // Live migration — transaction per business with 30s timeout
      await prisma.$transaction(async (tx) => {
        // 1. Create BUSINESS client (firstName stores business name for display compat)
        const bizClient = await tx.client.create({
          data: {
            clientType: 'BUSINESS',
            firstName: business.name,
            name: business.name,
            phone: bizPhone,
            organizationId: business.client.organizationId,
            managedById: business.client.managedById,
            businessType: business.type,
            einEncrypted: business.einEncrypted,
            businessAddress: business.address,
            businessCity: business.city,
            businessState: business.state,
            businessZip: business.zip,
          },
        })

        // 2. Create or reuse ClientGroup
        //    Re-read owner inside tx to get fresh clientGroupId
        //    (handles case where two businesses share same owner)
        const freshOwner = await tx.client.findUniqueOrThrow({
          where: { id: business.client.id },
          select: { clientGroupId: true },
        })
        let groupId = freshOwner.clientGroupId

        if (!groupId) {
          const group = await tx.clientGroup.create({
            data: {
              name: `${ownerName} Group`,
              organizationId: business.client.organizationId,
            },
          })
          groupId = group.id
          stats.groupsCreated++

          // Link owner to group
          await tx.client.update({
            where: { id: business.client.id },
            data: { clientGroupId: groupId },
          })
        }

        // Link business client to group
        await tx.client.update({
          where: { id: bizClient.id },
          data: { clientGroupId: groupId },
        })

        // 3. Backfill Contractor.clientId
        if (contractorCount > 0) {
          const result = await tx.contractor.updateMany({
            where: { businessId: business.id },
            data: { clientId: bizClient.id },
          })
          stats.contractorsUpdated += result.count
        }

        // 4. Backfill FilingBatch.clientId
        if (batchCount > 0) {
          const result = await tx.filingBatch.updateMany({
            where: { businessId: business.id },
            data: { clientId: bizClient.id },
          })
          stats.filingBatchesUpdated += result.count
        }

        // 5. Backfill ContractorIntakeToken.clientId
        if (tokenCount > 0) {
          const result = await tx.contractorIntakeToken.updateMany({
            where: { businessId: business.id },
            data: { clientId: bizClient.id },
          })
          stats.intakeTokensUpdated += result.count
        }

        console.log(`${logPrefix} MIGRATED → client ${bizClient.id}, group ${groupId}`)
        console.log(`  - ${contractorCount} contractors, ${batchCount} batches, ${tokenCount} tokens updated`)
      }, { timeout: 30000 })

      stats.migrated++
    } catch (err) {
      stats.errors++
      console.error(`${logPrefix} ERROR:`, err instanceof Error ? err.message : err)
    }
  }

  // Summary
  console.log('\n=== Migration Summary ===')
  console.log(`Total businesses:       ${stats.total}`)
  console.log(`Migrated:               ${stats.migrated}`)
  console.log(`Skipped (existing):     ${stats.skipped}`)
  console.log(`Errors:                 ${stats.errors}`)
  console.log(`Groups created:         ${stats.groupsCreated}`)
  console.log(`Contractors updated:    ${stats.contractorsUpdated}`)
  console.log(`Filing batches updated: ${stats.filingBatchesUpdated}`)
  console.log(`Intake tokens updated:  ${stats.intakeTokensUpdated}`)

  if (stats.errors > 0) {
    console.error('\n⚠ Some businesses failed to migrate. Review errors above.')
    process.exit(1)
  }

  console.log('\n✓ Migration complete.')
}

main()
  .catch((err) => {
    console.error('Fatal error:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
