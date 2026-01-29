/**
 * TaxEngagement helper functions
 * Provides utilities for finding or creating engagements when creating TaxCases
 */
import type { PrismaClient, Prisma, EngagementStatus, ClientProfile } from '@ella/db'

type TransactionClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

interface EngagementData {
  engagementId: string
  isNew: boolean
}

/**
 * Find or create a TaxEngagement for the given client and tax year.
 * If engagement exists, returns it. Otherwise creates a new one.
 *
 * When creating, copies profile data from ClientProfile if available.
 *
 * @param tx - Prisma transaction client
 * @param clientId - Client ID
 * @param taxYear - Tax year for the engagement
 * @param profile - Optional ClientProfile to copy data from (for new engagements)
 */
export async function findOrCreateEngagement(
  tx: TransactionClient,
  clientId: string,
  taxYear: number,
  profile?: ClientProfile | null
): Promise<EngagementData> {
  // Try to find existing engagement
  const existing = await tx.taxEngagement.findUnique({
    where: {
      clientId_taxYear: { clientId, taxYear }
    }
  })

  if (existing) {
    return { engagementId: existing.id, isNew: false }
  }

  // Determine initial status - DRAFT for new engagements
  const status: EngagementStatus = 'DRAFT'

  // Create new engagement, copying profile data if available
  const newEngagement = await tx.taxEngagement.create({
    data: {
      clientId,
      taxYear,
      status,
      // Copy profile data with null safety
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
      intakeAnswers: (profile?.intakeAnswers as Prisma.JsonValue) ?? {}
    }
  })

  return { engagementId: newEngagement.id, isNew: true }
}
