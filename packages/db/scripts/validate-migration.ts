/**
 * Migration Validation Script for Multi-Year Client Engagement
 * Validates data integrity after Phase 2 backfill and Phase 3 schema changes
 *
 * Checks:
 * 1. All TaxCases have engagementId (no null values)
 * 2. Engagement count matches unique (clientId, taxYear) pairs
 * 3. No orphaned TaxCases (invalid engagementId references)
 * 4. Engagements have profile data populated
 * 5. Referential integrity (matching clientId+taxYear)
 *
 * Usage: pnpm -F @ella/db run validate:migration
 */
import { PrismaClient } from '../src/generated/index.js'

const prisma = new PrismaClient()

interface ValidationResult {
  check: string
  passed: boolean
  expected: number | string
  actual: number | string
  message?: string
}

/**
 * Run comprehensive migration validation checks
 */
async function validateMigration(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = []

  console.log('Running validation checks...\n')

  // Check 1: All TaxCases have engagementId (no nulls)
  console.log('Check 1: All TaxCases have engagementId...')
  const nullEngagements = await prisma.taxCase.count({
    where: { engagementId: undefined },
  })
  results.push({
    check: 'All TaxCases have engagementId',
    passed: nullEngagements === 0,
    expected: 0,
    actual: nullEngagements,
    message: nullEngagements > 0
      ? `${nullEngagements} case(s) missing engagementId - run backfill script`
      : undefined,
  })

  // Check 2: Engagement count >= unique (clientId, taxYear) pairs
  console.log('Check 2: Engagement count matches unique pairs...')
  const engagementCount = await prisma.taxEngagement.count()
  const uniquePairs = await prisma.taxCase.findMany({
    distinct: ['clientId', 'taxYear'],
    select: { clientId: true, taxYear: true },
  })
  results.push({
    check: 'Engagement count matches unique (clientId, taxYear) pairs',
    passed: engagementCount >= uniquePairs.length,
    expected: `>= ${uniquePairs.length}`,
    actual: engagementCount,
    message: engagementCount < uniquePairs.length
      ? 'Missing engagements - backfill incomplete'
      : undefined,
  })

  // Check 3: No orphaned TaxCases (engagementId points to non-existent engagement)
  console.log('Check 3: No orphaned TaxCases...')
  const orphanedCases = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count
    FROM "TaxCase" tc
    LEFT JOIN "TaxEngagement" te ON tc."engagementId" = te.id
    WHERE tc."engagementId" IS NOT NULL AND te.id IS NULL
  `
  const orphanCount = Number(orphanedCases[0]?.count ?? 0)

  // Log details of orphaned cases for debugging
  if (orphanCount > 0) {
    const orphanedDetails = await prisma.$queryRaw<{ id: string; engagementId: string }[]>`
      SELECT tc.id, tc."engagementId"
      FROM "TaxCase" tc
      LEFT JOIN "TaxEngagement" te ON tc."engagementId" = te.id
      WHERE tc."engagementId" IS NOT NULL AND te.id IS NULL
      LIMIT 10
    `
    console.log('\n  Orphaned TaxCases (first 10):')
    orphanedDetails.forEach(c => {
      console.log(`    - Case ID: ${c.id}, Invalid Engagement ID: ${c.engagementId}`)
    })
  }

  results.push({
    check: 'No orphaned TaxCases (invalid engagementId)',
    passed: orphanCount === 0,
    expected: 0,
    actual: orphanCount,
    message: orphanCount > 0
      ? `${orphanCount} case(s) have invalid engagementId reference`
      : undefined,
  })

  // Check 4: Engagements have profile data (warning if >50% empty)
  console.log('Check 4: Engagements have profile data...')
  const emptyEngagements = await prisma.taxEngagement.count({
    where: {
      AND: [
        { filingStatus: null },
        { hasW2: false },
        { hasSelfEmployment: false },
        { intakeAnswers: { equals: {} } },
      ],
    },
  })
  const totalEngagements = await prisma.taxEngagement.count()
  const threshold = Math.floor(totalEngagements * 0.5)

  // Per-field coverage metrics
  if (totalEngagements > 0) {
    const filingStatusCount = await prisma.taxEngagement.count({ where: { filingStatus: { not: null } } })
    const hasW2Count = await prisma.taxEngagement.count({ where: { hasW2: true } })
    const hasSelfEmploymentCount = await prisma.taxEngagement.count({ where: { hasSelfEmployment: true } })
    const hasIntakeCount = await prisma.taxEngagement.count({ where: { NOT: { intakeAnswers: { equals: {} } } } })

    console.log('\n  Profile field coverage:')
    console.log(`    - filingStatus set:    ${filingStatusCount}/${totalEngagements} (${((filingStatusCount / totalEngagements) * 100).toFixed(1)}%)`)
    console.log(`    - hasW2=true:          ${hasW2Count}/${totalEngagements} (${((hasW2Count / totalEngagements) * 100).toFixed(1)}%)`)
    console.log(`    - hasSelfEmployment:   ${hasSelfEmploymentCount}/${totalEngagements} (${((hasSelfEmploymentCount / totalEngagements) * 100).toFixed(1)}%)`)
    console.log(`    - intakeAnswers set:   ${hasIntakeCount}/${totalEngagements} (${((hasIntakeCount / totalEngagements) * 100).toFixed(1)}%)`)
  }

  results.push({
    check: 'Engagements have profile data populated',
    passed: emptyEngagements < threshold || totalEngagements === 0,
    expected: `< ${threshold} (50% of ${totalEngagements})`,
    actual: emptyEngagements,
    message: emptyEngagements >= threshold
      ? `Warning: ${emptyEngagements} engagements have no profile data - may indicate backfill issue`
      : undefined,
  })

  // Check 5: Referential integrity - case (clientId, taxYear) matches engagement
  console.log('Check 5: Referential integrity...')
  const brokenRefs = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT tc.id FROM "TaxCase" tc
      JOIN "TaxEngagement" te ON tc."engagementId" = te.id
      WHERE tc."clientId" != te."clientId" OR tc."taxYear" != te."taxYear"
    ) sub
  `
  const brokenCount = Number(brokenRefs[0]?.count ?? 0)
  results.push({
    check: 'TaxCase (clientId, taxYear) matches linked engagement',
    passed: brokenCount === 0,
    expected: 0,
    actual: brokenCount,
    message: brokenCount > 0
      ? `${brokenCount} case(s) have mismatched clientId/taxYear with engagement`
      : undefined,
  })

  // Check 6: No duplicate engagements (clientId, taxYear unique)
  console.log('Check 6: No duplicate engagements...')
  const duplicates = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "clientId", "taxYear"
      FROM "TaxEngagement"
      GROUP BY "clientId", "taxYear"
      HAVING COUNT(*) > 1
    ) sub
  `
  const duplicateCount = Number(duplicates[0]?.count ?? 0)
  results.push({
    check: 'No duplicate (clientId, taxYear) in TaxEngagement',
    passed: duplicateCount === 0,
    expected: 0,
    actual: duplicateCount,
    message: duplicateCount > 0
      ? `${duplicateCount} duplicate engagement pair(s) found - violates unique constraint`
      : undefined,
  })

  // Check 7: Engagement status distribution (info only)
  console.log('Check 7: Engagement status distribution...')
  const statusCounts = await prisma.taxEngagement.groupBy({
    by: ['status'],
    _count: true,
  })
  const statusSummary = statusCounts
    .map(s => `${s.status}: ${s._count}`)
    .join(', ')
  results.push({
    check: 'Engagement status distribution (info)',
    passed: true, // Info only
    expected: 'N/A',
    actual: statusSummary || 'No engagements',
    message: undefined,
  })

  return results
}

/**
 * Print validation results
 */
function printResults(results: ValidationResult[]): boolean {
  console.log('\n' + '='.repeat(70))
  console.log('VALIDATION RESULTS')
  console.log('='.repeat(70) + '\n')

  let allPassed = true

  for (const result of results) {
    const status = result.passed ? '✓ PASS' : '✗ FAIL'
    const color = result.passed ? '\x1b[32m' : '\x1b[31m'
    const reset = '\x1b[0m'

    console.log(`${color}${status}${reset}: ${result.check}`)
    console.log(`       Expected: ${result.expected}`)
    console.log(`       Actual:   ${result.actual}`)
    if (result.message) {
      console.log(`       Note:     ${result.message}`)
    }
    console.log()

    if (!result.passed && !result.check.includes('(info)')) {
      allPassed = false
    }
  }

  console.log('='.repeat(70))
  if (allPassed) {
    console.log('\x1b[32m✓ All validation checks passed!\x1b[0m')
  } else {
    console.log('\x1b[31m✗ Some validation checks failed!\x1b[0m')
    console.log('\nRecommended actions:')
    console.log('1. Run backfill script: pnpm -F @ella/db run backfill:engagements')
    console.log('2. Check for data issues in the failing checks')
    console.log('3. Re-run validation after fixes')
  }
  console.log('='.repeat(70) + '\n')

  return allPassed
}

/**
 * Generate summary statistics
 */
async function printStats(): Promise<void> {
  console.log('\n--- Database Statistics ---')

  const clientCount = await prisma.client.count()
  const engagementCount = await prisma.taxEngagement.count()
  const caseCount = await prisma.taxCase.count()

  console.log(`Clients:      ${clientCount}`)
  console.log(`Engagements:  ${engagementCount}`)
  console.log(`Tax Cases:    ${caseCount}`)

  // Engagements per client
  if (clientCount > 0) {
    const avgEngagements = (engagementCount / clientCount).toFixed(2)
    console.log(`Avg engagements/client: ${avgEngagements}`)
  }

  // Year distribution
  const yearDist = await prisma.taxEngagement.groupBy({
    by: ['taxYear'],
    _count: true,
    orderBy: { taxYear: 'desc' },
  })
  if (yearDist.length > 0) {
    console.log('\nEngagements by year:')
    yearDist.forEach(y => {
      console.log(`  ${y.taxYear}: ${y._count}`)
    })
  }

  console.log()
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  console.log('╔══════════════════════════════════════════════════════════════════╗')
  console.log('║     Multi-Year Client Engagement Migration Validation            ║')
  console.log('╚══════════════════════════════════════════════════════════════════╝\n')

  try {
    await printStats()

    const results = await validateMigration()
    const allPassed = printResults(results)

    process.exit(allPassed ? 0 : 1)
  } catch (error) {
    console.error('\x1b[31mValidation script failed:\x1b[0m', error)
    process.exit(2)
  } finally {
    await prisma.$disconnect()
  }
}

main()
