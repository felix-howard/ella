/**
 * Main Seed File
 * Orchestrates all seed modules
 */
import { PrismaClient } from '../src/generated/index.js'
import { seedIntakeQuestions } from './seed-intake-questions.js'
import { seedChecklistTemplates } from './seed-checklist-templates.js'
import { seedDocTypeLibrary } from './seed-doc-library.js'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...\n')

  // Seed in order of dependencies
  // 1. Doc Type Library (no dependencies)
  await seedDocTypeLibrary()

  // 2. Intake Questions (no dependencies)
  await seedIntakeQuestions()

  // 3. Checklist Templates (may reference DocTypeLibrary in future)
  await seedChecklistTemplates()

  console.log('\nSeed completed successfully!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
