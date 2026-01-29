/**
 * Phase 2 verification script - checks if backfill is complete
 * Required before Phase 3 (schema cleanup) can proceed.
 */
import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function verify() {
  console.log('[Phase 2 Verification] Running checks...\n')

  // Check 1: TaxCases with null engagementId
  const nullCount = await prisma.taxCase.count({
    where: { engagementId: null }
  })
  console.log(`TaxCases with null engagementId: ${nullCount}`)

  // Check 2: Orphaned engagementIds
  const orphanedCases = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM "TaxCase" tc
    LEFT JOIN "TaxEngagement" te ON tc."engagementId" = te.id
    WHERE tc."engagementId" IS NOT NULL AND te.id IS NULL
  `
  const orphanCount = Number(orphanedCases[0].count)
  console.log(`Orphaned TaxCases (invalid engagementId): ${orphanCount}`)

  // Summary
  const passed = nullCount === 0 && orphanCount === 0
  console.log(`\n${passed ? '✅ PASSED' : '❌ FAILED'}: Phase 2 verification`)

  if (!passed) {
    console.log('\nPhase 3 cannot proceed until:')
    if (nullCount > 0) console.log(`  - All ${nullCount} TaxCases have engagementId populated`)
    if (orphanCount > 0) console.log(`  - Fix ${orphanCount} orphaned TaxCases with invalid engagementId`)
  }

  await prisma.$disconnect()
  process.exit(passed ? 0 : 1)
}

verify().catch(e => {
  console.error(e)
  process.exit(1)
})
