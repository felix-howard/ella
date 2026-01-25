/**
 * Backfill TaxEngagement records from existing ClientProfile + TaxCase data.
 * Phase 2 of Multi-Year Client Engagement migration.
 *
 * Usage: pnpm run backfill:engagements
 *
 * This script:
 * 1. Finds all TaxCases without engagementId
 * 2. Groups them by (clientId, taxYear)
 * 3. Creates TaxEngagement for each unique pair, copying ClientProfile data
 * 4. Links TaxCases to their engagements (batch updateMany)
 *
 * Engagement Status Logic:
 * - COMPLETE: All TaxCases for (clientId, taxYear) have isFiled=true
 * - ACTIVE: Any TaxCase has status beyond INTAKE, or at least one is filed
 * - DRAFT: Default - only INTAKE status cases exist
 */

import { PrismaClient, EngagementStatus, Prisma } from '../src/generated'

const prisma = new PrismaClient()
const PROGRESS_LOG_INTERVAL = 100 // Log progress every N groups

interface BackfillStats {
  engagementsProcessed: number // Created or found existing
  engagementsCreated: number   // Actually newly created
  casesLinked: number
  errors: number
}

/**
 * Safely extracts JSON data, returning empty object on invalid data
 */
function safeParseIntakeAnswers(data: unknown): Prisma.JsonValue {
  if (data === null || data === undefined) return {}
  if (typeof data === 'object' && !Array.isArray(data)) return data as Prisma.JsonValue
  return {}
}

async function backfillEngagements(): Promise<BackfillStats> {
  console.log('[Backfill] Starting TaxEngagement backfill...')
  console.log('[Backfill] Timestamp:', new Date().toISOString())

  const stats: BackfillStats = {
    engagementsProcessed: 0,
    engagementsCreated: 0,
    casesLinked: 0,
    errors: 0
  }

  // Get all TaxCases without engagementId
  const taxCases = await prisma.taxCase.findMany({
    where: { engagementId: null },
    include: {
      client: {
        include: { profile: true }
      }
    },
    orderBy: { createdAt: 'asc' }
  })

  console.log(`[Backfill] Found ${taxCases.length} TaxCases without engagementId`)

  if (taxCases.length === 0) {
    console.log('[Backfill] No TaxCases to process. Exiting.')
    return stats
  }

  // Group by clientId + taxYear
  const groups = new Map<string, typeof taxCases>()
  for (const tc of taxCases) {
    const key = `${tc.clientId}_${tc.taxYear}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tc)
  }

  console.log(`[Backfill] ${groups.size} unique (clientId, taxYear) pairs to process`)

  let processedGroups = 0

  for (const [key, cases] of groups) {
    const firstCase = cases[0]
    const profile = firstCase.client.profile

    try {
      // Determine engagement status based on TaxCase status
      // COMPLETE: All cases filed, ACTIVE: Some work done, DRAFT: Only intake
      const allFiled = cases.every(c => c.isFiled)
      const hasActiveCase = cases.some(c => !c.isFiled && c.status !== 'INTAKE')
      const hasFiledCase = cases.some(c => c.isFiled)

      let engagementStatus: EngagementStatus = 'DRAFT'
      if (allFiled) {
        engagementStatus = 'COMPLETE'
      } else if (hasActiveCase || hasFiledCase) {
        engagementStatus = 'ACTIVE'
      }

      const caseIds = cases.map(c => c.id)

      // Use transaction for atomicity - ensures engagement and case linking happen together
      await prisma.$transaction(async (tx) => {
        // Check if engagement already exists
        const existing = await tx.taxEngagement.findUnique({
          where: {
            clientId_taxYear: {
              clientId: firstCase.clientId,
              taxYear: firstCase.taxYear
            }
          }
        })

        let engagementId: string

        if (existing) {
          engagementId = existing.id
          stats.engagementsProcessed++
        } else {
          // Create new engagement
          const newEngagement = await tx.taxEngagement.create({
            data: {
              clientId: firstCase.clientId,
              taxYear: firstCase.taxYear,
              status: engagementStatus,
              // Copy profile data (with null safety)
              filingStatus: profile?.filingStatus ?? null,
              hasW2: profile?.hasW2 ?? false,
              hasBankAccount: profile?.hasBankAccount ?? false,
              hasInvestments: profile?.hasInvestments ?? false,
              hasKidsUnder17: profile?.hasKidsUnder17 ?? false,
              numKidsUnder17: profile?.numKidsUnder17 ?? 0,
              paysDaycare: profile?.paysDaycare ?? false,
              hasKids17to24: profile?.hasKids17to24 ?? false,
              hasSelfEmployment: profile?.hasSelfEmployment ?? false,
              hasRentalProperty: profile?.hasRentalProperty ?? false,
              businessName: profile?.businessName ?? null,
              ein: profile?.ein ?? null,
              hasEmployees: profile?.hasEmployees ?? false,
              hasContractors: profile?.hasContractors ?? false,
              has1099K: profile?.has1099K ?? false,
              intakeAnswers: safeParseIntakeAnswers(profile?.intakeAnswers)
            }
          })
          engagementId = newEngagement.id
          stats.engagementsProcessed++
          stats.engagementsCreated++
        }

        // Batch update all cases in this group (fixes N+1 query issue)
        const updateResult = await tx.taxCase.updateMany({
          where: { id: { in: caseIds } },
          data: { engagementId }
        })
        stats.casesLinked += updateResult.count
      })

      processedGroups++

      // Progress logging every PROGRESS_LOG_INTERVAL groups
      if (processedGroups % PROGRESS_LOG_INTERVAL === 0) {
        console.log(
          `[Backfill] Progress: ${processedGroups}/${groups.size} groups | ` +
          `${stats.engagementsCreated} created, ${stats.casesLinked} cases linked`
        )
      }
    } catch (error) {
      console.error(`[Backfill] Error processing ${key}:`, error)
      stats.errors++
    }
  }

  return stats
}

async function verifyBackfill(): Promise<{ passed: boolean; details: string[] }> {
  console.log('\n[Verification] Running post-backfill checks...')
  const issues: string[] = []

  // Check 1: No TaxCases with null engagementId
  const nullCount = await prisma.taxCase.count({
    where: { engagementId: null }
  })
  console.log(`[Verification] TaxCases with null engagementId: ${nullCount}`)
  if (nullCount > 0) {
    issues.push(`${nullCount} TaxCases still have null engagementId`)
  }

  // Check 2: Engagement count matches unique pairs (fixed SQL syntax)
  const engagementCount = await prisma.taxEngagement.count()
  const uniquePairsResult = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM (
      SELECT DISTINCT "clientId", "taxYear" FROM "TaxCase"
    ) AS unique_pairs
  `
  const uniquePairs = Number(uniquePairsResult[0].count)

  console.log(`[Verification] TaxEngagement count: ${engagementCount}`)
  console.log(`[Verification] Unique (clientId, taxYear) pairs in TaxCase: ${uniquePairs}`)

  // Note: engagementCount >= uniquePairs is valid (engagement could exist without cases)
  if (engagementCount < uniquePairs) {
    issues.push(`Missing engagements: ${uniquePairs} unique pairs but only ${engagementCount} engagements`)
  }

  // Check 3: Referential integrity - no orphaned cases
  const orphanedCases = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count
    FROM "TaxCase" tc
    LEFT JOIN "TaxEngagement" te ON tc."engagementId" = te.id
    WHERE tc."engagementId" IS NOT NULL AND te.id IS NULL
  `
  const orphanCount = Number(orphanedCases[0].count)
  console.log(`[Verification] Orphaned TaxCases (invalid engagementId): ${orphanCount}`)
  if (orphanCount > 0) {
    issues.push(`${orphanCount} TaxCases have invalid engagementId (no matching TaxEngagement)`)
  }

  // Check 4: No duplicate engagements for same (clientId, taxYear)
  const duplicateEngagements = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT COUNT(*) as count FROM (
      SELECT "clientId", "taxYear", COUNT(*) as cnt
      FROM "TaxEngagement"
      GROUP BY "clientId", "taxYear"
      HAVING COUNT(*) > 1
    ) AS duplicates
  `
  const duplicateCount = Number(duplicateEngagements[0].count)
  console.log(`[Verification] Duplicate engagement pairs: ${duplicateCount}`)
  if (duplicateCount > 0) {
    issues.push(`${duplicateCount} duplicate (clientId, taxYear) pairs in TaxEngagement`)
  }

  // Sample data display
  const sampleData = await prisma.taxEngagement.findMany({
    take: 3,
    include: {
      client: { select: { name: true } },
      taxCases: { select: { id: true, status: true } }
    },
    orderBy: { createdAt: 'desc' }
  })

  if (sampleData.length > 0) {
    console.log('\n[Verification] Sample TaxEngagement records:')
    for (const te of sampleData) {
      console.log(
        `  - ${te.id}: ${te.client.name} | ${te.taxYear} | ` +
        `Status: ${te.status} | Cases: ${te.taxCases.length}`
      )
    }
  }

  return { passed: issues.length === 0, details: issues }
}

async function main() {
  try {
    const stats = await backfillEngagements()

    console.log('\n[Backfill] Complete!')
    console.log(`  Engagements processed: ${stats.engagementsProcessed}`)
    console.log(`  Engagements created: ${stats.engagementsCreated}`)
    console.log(`  TaxCases linked: ${stats.casesLinked}`)
    console.log(`  Errors: ${stats.errors}`)

    // Check for errors before verification
    if (stats.errors > 0) {
      console.error(`\n[Backfill] FAILED: ${stats.errors} errors occurred during processing`)
      process.exit(1)
    }

    const verification = await verifyBackfill()

    if (verification.passed) {
      console.log('\n[Backfill] SUCCESS: All verification checks passed!')
      process.exit(0)
    } else {
      console.error('\n[Backfill] FAILED: Verification checks failed!')
      for (const issue of verification.details) {
        console.error(`  - ${issue}`)
      }
      process.exit(1)
    }
  } catch (error) {
    console.error('[Backfill] Fatal error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
