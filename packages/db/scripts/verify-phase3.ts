/**
 * Phase 3 post-migration verification script
 * Verifies engagementId is NOT NULL and FK uses CASCADE delete
 */
import { PrismaClient } from '../src/generated'

const prisma = new PrismaClient()

async function verify() {
  console.log('[Phase 3 Verification] Running post-migration checks...\n')

  // Check 1: NOT NULL constraint
  const nullableCheck = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`
    SELECT column_name, is_nullable
    FROM information_schema.columns
    WHERE table_name = 'TaxCase' AND column_name = 'engagementId'
  `

  if (nullableCheck.length === 0) {
    console.log('❌ engagementId column not found in TaxCase table')
    process.exit(1)
  }

  const isNullable = nullableCheck[0].is_nullable
  console.log(`engagementId is_nullable: ${isNullable}`)
  const notNullPassed = isNullable === 'NO'
  console.log(`${notNullPassed ? '✅' : '❌'} NOT NULL constraint: ${notNullPassed ? 'PASSED' : 'FAILED'}`)

  // Check 2: FK constraint with CASCADE delete
  const fkCheck = await prisma.$queryRaw<{ constraint_name: string; delete_rule: string }[]>`
    SELECT
      tc.constraint_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'TaxCase'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'engagementId'
  `

  if (fkCheck.length === 0) {
    console.log('❌ FK constraint for engagementId not found')
    process.exit(1)
  }

  const deleteRule = fkCheck[0].delete_rule
  console.log(`\nengagementId FK delete_rule: ${deleteRule}`)
  const cascadePassed = deleteRule === 'CASCADE'
  console.log(`${cascadePassed ? '✅' : '❌'} CASCADE delete: ${cascadePassed ? 'PASSED' : 'FAILED'}`)

  // Summary
  const allPassed = notNullPassed && cascadePassed
  console.log(`\n${allPassed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`)

  await prisma.$disconnect()
  process.exit(allPassed ? 0 : 1)
}

verify().catch(e => {
  console.error(e)
  process.exit(1)
})
