/**
 * Backfill multi-entity portal columns introduced in Phase 01:
 *   1. RawImage.uploadSource — flip legacy CPA-side uploads from default
 *      'PORTAL_AI' to 'CPA_MANUAL' based on existing `uploadedVia` enum.
 *   2. MagicLink.scope/clientGroupId — upgrade active PORTAL tokens whose
 *      client belongs to a multi-member ClientGroup from CASE → GROUP.
 *
 * IDEMPOTENT: Safe to re-run. Only updates rows whose current value differs
 * from the computed expected value.
 *
 * Usage:
 *   pnpm -F @ella/db backfill:multi-entity                          # dry run (default)
 *   pnpm -F @ella/db backfill:multi-entity -- --apply               # write changes
 *   pnpm -F @ella/db backfill:multi-entity -- --target=rawImage     # one section only
 *   pnpm -F @ella/db backfill:multi-entity -- --apply --limit=100   # cap rows
 *
 * Recommended order:
 *   1. Run with no flags → review counts in DRY-RUN summary.
 *   2. Spot-check a few rows in `psql` (read-only).
 *   3. Re-run with `--apply` to write.
 *   4. Re-run with no flags again — should report 0 updates (idempotent).
 */

import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

type Target = 'all' | 'rawImage' | 'magicLink'

interface Args {
  dryRun: boolean
  target: Target
  limit?: number
}

interface SectionStats {
  scanned: number
  updated: number
  skipped: number
  errors: number
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const dryRun = !argv.includes('--apply')
  const targetRaw = argv.find((a) => a.startsWith('--target='))?.split('=')[1] ?? 'all'
  const limitRaw = argv.find((a) => a.startsWith('--limit='))?.split('=')[1]

  if (!['all', 'rawImage', 'magicLink'].includes(targetRaw)) {
    console.error(`[Backfill] Invalid --target value: ${targetRaw}. Allowed: all, rawImage, magicLink`)
    process.exit(1)
  }

  const limit = limitRaw ? Number(limitRaw) : undefined
  if (limit !== undefined && (!Number.isFinite(limit) || limit <= 0)) {
    console.error(`[Backfill] Invalid --limit value: ${limitRaw}. Must be positive integer.`)
    process.exit(1)
  }

  return { dryRun, target: targetRaw as Target, limit }
}

const RAW_IMAGE_PAGE_SIZE = 500

/**
 * RawImage: flip legacy CPA uploads from PORTAL_AI default to CPA_MANUAL.
 * Skips PORTAL_EXPLICIT rows entirely (post-launch owner choice — never overwrite).
 */
async function backfillRawImages(args: Args): Promise<SectionStats> {
  const stats: SectionStats = { scanned: 0, updated: 0, skipped: 0, errors: 0 }

  let cursorId: string | undefined
  let processed = 0

  while (true) {
    if (args.limit !== undefined && processed >= args.limit) break

    const remainingFromLimit = args.limit !== undefined ? args.limit - processed : Number.POSITIVE_INFINITY
    const take = Math.min(RAW_IMAGE_PAGE_SIZE, remainingFromLimit)

    const page = await prisma.rawImage.findMany({
      where: {
        uploadSource: 'PORTAL_AI',
        uploadedVia: { not: 'PORTAL' },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take,
      ...(cursorId ? { cursor: { id: cursorId }, skip: 1 } : {}),
    })

    if (page.length === 0) break

    stats.scanned += page.length
    processed += page.length
    cursorId = page[page.length - 1].id

    if (!args.dryRun) {
      try {
        const result = await prisma.rawImage.updateMany({
          where: { id: { in: page.map((r) => r.id) } },
          data: { uploadSource: 'CPA_MANUAL' },
        })
        stats.updated += result.count
      } catch (err) {
        console.error('[Backfill] RawImage batch error:', err)
        stats.errors++
      }
    } else {
      stats.updated += page.length // would-be updates
    }

    if (page.length < take) break
  }

  return stats
}

/**
 * MagicLink: upgrade active PORTAL CASE-scoped tokens to GROUP scope when the
 * client belongs to a multi-member ClientGroup. Solo clients & non-grouped
 * clients stay CASE.
 */
async function backfillMagicLinks(args: Args): Promise<SectionStats> {
  const stats: SectionStats = { scanned: 0, updated: 0, skipped: 0, errors: 0 }

  const candidates = await prisma.magicLink.findMany({
    where: {
      type: 'PORTAL',
      isActive: true,
      scope: 'CASE',
      clientGroupId: null,
    },
    select: {
      id: true,
      taxCase: { select: { client: { select: { clientGroupId: true } } } },
    },
    take: args.limit,
  })

  for (const link of candidates) {
    stats.scanned++
    const groupId = link.taxCase?.client?.clientGroupId

    if (!groupId) {
      stats.skipped++
      continue
    }

    try {
      const siblingCount = await prisma.client.count({ where: { clientGroupId: groupId } })
      if (siblingCount <= 1) {
        stats.skipped++
        continue
      }

      if (!args.dryRun) {
        await prisma.magicLink.update({
          where: { id: link.id },
          data: { scope: 'GROUP', clientGroupId: groupId },
        })
      }
      stats.updated++
    } catch (err) {
      console.error(`[Backfill] MagicLink ${link.id} error:`, err)
      stats.errors++
    }
  }

  return stats
}

function printSection(name: string, s: SectionStats, dryRun: boolean) {
  // In dry-run: `updated` reflects rows that *would* be written. In apply: actual writes.
  // Errors: RawImage counts batch-level failures (one per failed 500-row batch); MagicLink counts row-level failures.
  const label = dryRun ? 'wouldUpdate' : 'updated'
  console.log(
    `${name.padEnd(11)} scanned=${s.scanned} ${label}=${s.updated} skipped=${s.skipped} errors=${s.errors}`,
  )
}

async function main() {
  const args = parseArgs()

  console.log('=== Multi-entity portal backfill ===')
  console.log(`mode:        ${args.dryRun ? 'DRY-RUN' : 'APPLY'}`)
  console.log(`target:      ${args.target}`)
  if (args.limit !== undefined) console.log(`limit:       ${args.limit}`)
  console.log(`timestamp:   ${new Date().toISOString()}`)
  console.log('')

  const empty: SectionStats = { scanned: 0, updated: 0, skipped: 0, errors: 0 }
  const rawStats = args.target === 'magicLink' ? empty : await backfillRawImages(args)
  const linkStats = args.target === 'rawImage' ? empty : await backfillMagicLinks(args)

  console.log('')
  printSection('rawImage:', rawStats, args.dryRun)
  printSection('magicLink:', linkStats, args.dryRun)

  const totalErrors = rawStats.errors + linkStats.errors
  if (totalErrors > 0) {
    console.error(`\n[Backfill] FAILED with ${totalErrors} error(s)`)
    process.exit(1)
  }

  if (args.dryRun) {
    console.log('\n[Backfill] DRY-RUN complete — no changes written. Re-run with --apply to commit.')
  } else {
    console.log('\n[Backfill] APPLY complete.')
  }
}

main()
  .catch((e) => {
    console.error('[Backfill] Fatal error:', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
