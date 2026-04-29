/**
 * QA Phone Collision Seed (dev-only)
 *
 * Seeds a Lead and an active Client that share the same phone number so
 * you can manually validate inbound-SMS routing per brainstorm §5.3:
 * client case must win, collision must be logged with masked phone.
 *
 * Usage (from repo root):
 *   pnpm tsx scripts/qa-phone-collision-seed.ts
 *
 * Refuses to run when NODE_ENV=production. No teardown — delete the seeded
 * rows manually once QA is complete (ids printed on success).
 */
import { PrismaClient } from '@ella/db'

const prisma = new PrismaClient()

const COLLISION_PHONE = '+15557654321'

async function main() {
  if (process.env.NODE_ENV === 'production') {
    console.error('[qa-seed] refusing to run in production')
    process.exit(1)
  }

  const org = await prisma.organization.findFirst({ select: { id: true, name: true } })
  if (!org) {
    console.error('[qa-seed] no Organization found — seed your DB first')
    process.exit(1)
  }

  const staff = await prisma.staff.findFirst({
    where: { organizationId: org.id },
    select: { id: true },
  })
  if (!staff) {
    console.error(`[qa-seed] no Staff in org ${org.id} — seed your DB first`)
    process.exit(1)
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: 'QA',
      lastName: 'CollisionLead',
      phone: COLLISION_PHONE,
      status: 'NEW',
      organizationId: org.id,
    },
  })

  const client = await prisma.client.create({
    data: {
      firstName: 'QA',
      lastName: 'CollisionClient',
      name: 'QA CollisionClient',
      phone: COLLISION_PHONE,
      language: 'EN',
      source: 'MANUAL',
      clientType: 'INDIVIDUAL',
      organizationId: org.id,
      managedById: null,
      createdById: staff.id,
    },
  })

  const engagement = await prisma.taxEngagement.create({
    data: { clientId: client.id, taxYear: new Date().getFullYear(), status: 'DRAFT' },
  })

  const taxCase = await prisma.taxCase.create({
    data: {
      clientId: client.id,
      engagementId: engagement.id,
      taxYear: new Date().getFullYear(),
      taxTypes: ['FORM_1040'],
      status: 'INTAKE',
    },
  })

  console.log('[qa-seed] collision fixture ready')
  console.log('  phone     :', COLLISION_PHONE)
  console.log('  org       :', org.id, `(${org.name})`)
  console.log('  lead.id   :', lead.id)
  console.log('  client.id :', client.id)
  console.log('  case.id   :', taxCase.id)
  console.log('')
  console.log('Next steps:')
  console.log(`  1. POST Twilio webhook with From=${COLLISION_PHONE}`)
  console.log('  2. Expect: Message created on client conversation (not lead)')
  console.log('  3. Expect: "[InboundCollision]" warning in API logs (phone masked to ****4321)')
  console.log('')
  console.log('Cleanup:')
  console.log(`  DELETE FROM "Lead" WHERE id = '${lead.id}';`)
  console.log(`  DELETE FROM "Client" WHERE id = '${client.id}'; -- cascades case + engagement`)
}

main()
  .catch((err) => {
    console.error('[qa-seed] failed:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
