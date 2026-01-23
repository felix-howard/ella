# Phase 03: API Layer Updates

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Dependencies**: [Phase 02](./phase-02-data-migration.md) completed
- **Related Docs**: [researcher-database-migration.md](./research/researcher-database-migration.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-23 |
| Description | Update API to use TaxCase.yearlyAnswers with fallback to ClientProfile.intakeAnswers |
| Priority | High |
| Effort | 1.5d |
| Implementation Status | Not Started |
| Review Status | Pending |

## Key Insights

1. Checklist generator reads from ClientProfile - must update to read from TaxCase
2. Need new endpoint for creating TaxCase on existing client
3. Fallback logic ensures backward compatibility during transition
4. Client creation flow unchanged (still creates client + profile + case in one transaction)

## Requirements

### Functional
- Checklist generator reads yearlyAnswers from TaxCase (fallback to ClientProfile)
- New endpoint: `POST /clients/:id/cases` for returning clients
- Client GET endpoint returns all tax cases with yearlyAnswers
- Update profile endpoint should NOT touch yearlyAnswers (yearly data in TaxCase now)

### Non-Functional
- Fallback logic for 2-4 week transition period
- Clear logging for debugging data source
- No breaking changes to existing API contracts

## Architecture

### New Endpoint Flow
```
POST /clients/:id/cases
  Body: { taxYear, taxTypes, filingStatus, yearlyAnswers }

  1. Verify client exists
  2. Check no duplicate case for year
  3. Create TaxCase with yearlyAnswers
  4. Create Conversation
  5. Generate checklist (using yearlyAnswers)
  6. Return new case
```

### Checklist Generator Update
```
Current: generateChecklist(caseId, taxTypes, profile)
         -> reads profile.intakeAnswers

Updated: generateChecklist(caseId, taxTypes, profile, yearlyAnswers?)
         -> reads yearlyAnswers first, fallback to profile.intakeAnswers
```

## Related Code Files

### Modify
- `apps/api/src/services/checklist-generator.ts` - Add yearlyAnswers parameter
- `apps/api/src/routes/clients/index.ts` - Add POST /:id/cases endpoint
- `apps/api/src/routes/clients/schemas.ts` - Add createCaseForClientSchema
- `apps/api/src/routes/cases/index.ts` - Include yearlyAnswers in GET responses

### Create
- `apps/api/src/lib/yearly-answers.ts` - Helper functions for data access

## Implementation Steps

### Step 1: Create yearly-answers helper

File: `apps/api/src/lib/yearly-answers.ts`
```typescript
import type { TaxCase, ClientProfile } from '@ella/db'

const YEARLY_KEYS = [
  'hasW2', 'w2Count', 'has1099NEC', 'num1099NECReceived',
  'hasSelfEmployment', 'hasRentalProperty', 'rentalPropertyCount',
  'hasInvestments', 'hasCrypto', 'filingStatus',
  'numKidsUnder17', 'paysDaycare', 'hasKids17to24',
  'hasKids17to24InSchool', 'dependents', 'hasRetirement',
  'hasSocialSecurity', 'hasK1', 'k1Count', 'hasForeignAccounts',
  'hasMortgage', 'hasMedicalExpenses', 'hasCharitableContributions',
  'hasStudentLoanInterest', 'hasEducatorExpenses', 'hasPropertyTax'
] as const

export function getYearlyAnswers(
  taxCase: { yearlyAnswers?: unknown },
  profile?: { intakeAnswers?: unknown }
): Record<string, unknown> {
  // Prefer TaxCase.yearlyAnswers (new location)
  const yearly = parseJson(taxCase.yearlyAnswers)
  if (Object.keys(yearly).length > 0) {
    return yearly
  }

  // Fallback to ClientProfile.intakeAnswers (old location)
  const intake = parseJson(profile?.intakeAnswers)
  return extractYearlyFields(intake)
}

export function extractYearlyFields(
  intake: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const key of YEARLY_KEYS) {
    if (key in intake) {
      result[key] = intake[key]
    }
  }
  return result
}

function parseJson(value: unknown): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}
```

### Step 2: Update checklist generator

File: `apps/api/src/services/checklist-generator.ts`

```typescript
// Update generateChecklist signature
export async function generateChecklist(
  caseId: string,
  taxTypes: TaxType[],
  profile: ClientProfile,
  yearlyAnswersOverride?: Record<string, unknown>  // NEW
): Promise<void> {
  // Build context with yearly answers from TaxCase or profile
  const context = buildConditionContext(profile, yearlyAnswersOverride)
  // ... rest unchanged
}

// Update buildConditionContext
function buildConditionContext(
  profile: ClientProfile,
  yearlyAnswersOverride?: Record<string, unknown>
): ConditionContext {
  const intakeAnswers = parseIntakeAnswers(profile.intakeAnswers)

  // Use override if provided (from TaxCase.yearlyAnswers)
  const effectiveAnswers = yearlyAnswersOverride
    ? { ...intakeAnswers, ...yearlyAnswersOverride }
    : intakeAnswers

  // ... rest builds context from effectiveAnswers
}
```

### Step 3: Add new endpoint schema

File: `apps/api/src/routes/clients/schemas.ts`

```typescript
export const createCaseForClientSchema = z.object({
  taxYear: z.number().int().min(2020).max(2030),
  taxTypes: z.array(z.enum(['FORM_1040', 'FORM_1120S', 'FORM_1065'])).min(1),
  yearlyAnswers: z.record(z.unknown()).optional().default({}),
})
```

### Step 4: Add POST /clients/:id/cases endpoint

File: `apps/api/src/routes/clients/index.ts`

```typescript
// POST /clients/:id/cases - Create new tax case for existing client
clientsRoute.post(
  '/:id/cases',
  zValidator('param', clientIdParamSchema),
  zValidator('json', createCaseForClientSchema),
  async (c) => {
    const { id: clientId } = c.req.valid('param')
    const { taxYear, taxTypes, yearlyAnswers } = c.req.valid('json')

    // Verify client exists
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { profile: true, taxCases: { where: { taxYear } } }
    })

    if (!client) {
      return c.json({ error: 'NOT_FOUND', message: 'Client not found' }, 404)
    }

    // Check for duplicate year
    if (client.taxCases.length > 0) {
      return c.json({
        error: 'DUPLICATE_YEAR',
        message: `Tax case for ${taxYear} already exists`
      }, 409)
    }

    // Create case with yearlyAnswers
    const taxCase = await prisma.$transaction(async (tx) => {
      const newCase = await tx.taxCase.create({
        data: {
          clientId,
          taxYear,
          taxTypes: taxTypes as TaxType[],
          yearlyAnswers,
          status: 'INTAKE',
        }
      })

      await tx.conversation.create({
        data: { caseId: newCase.id, lastMessageAt: new Date() }
      })

      return newCase
    })

    // Generate checklist with yearlyAnswers
    if (client.profile) {
      await generateChecklist(
        taxCase.id,
        taxTypes as TaxType[],
        client.profile,
        yearlyAnswers  // Pass yearly answers
      )
    }

    // Create magic link
    const magicLink = await createMagicLink(taxCase.id)

    return c.json({
      taxCase: {
        id: taxCase.id,
        taxYear: taxCase.taxYear,
        taxTypes: taxCase.taxTypes,
        status: taxCase.status,
        yearlyAnswers: taxCase.yearlyAnswers,
      },
      magicLink,
    }, 201)
  }
)
```

### Step 5: Update GET responses to include yearlyAnswers

File: `apps/api/src/routes/cases/index.ts`
- Ensure `taxCase.yearlyAnswers` included in GET /cases/:id response

File: `apps/api/src/routes/clients/index.ts`
- Ensure `taxCases[].yearlyAnswers` included in GET /clients/:id response

### Step 6: Update refreshChecklist to use yearlyAnswers

```typescript
export async function refreshChecklist(caseId: string): Promise<void> {
  const taxCase = await prisma.taxCase.findUnique({
    where: { id: caseId },
    include: { client: { include: { profile: true } } }
  })

  if (!taxCase?.client?.profile) {
    throw new Error(`Case ${caseId} not found or missing profile`)
  }

  // Get yearly answers from case or fallback
  const yearlyAnswers = getYearlyAnswers(taxCase, taxCase.client.profile)

  await prisma.checklistItem.deleteMany({
    where: { caseId, status: 'MISSING' }
  })

  await generateChecklist(
    caseId,
    taxCase.taxTypes as TaxType[],
    taxCase.client.profile,
    yearlyAnswers  // Pass yearly answers
  )
}
```

## Todo List

- [ ] Create `apps/api/src/lib/yearly-answers.ts` helper module
- [ ] Update `checklist-generator.ts` to accept yearlyAnswers parameter
- [ ] Update `buildConditionContext` to use yearlyAnswers
- [ ] Add `createCaseForClientSchema` to schemas.ts
- [ ] Add `POST /clients/:id/cases` endpoint
- [ ] Update `GET /clients/:id` to include yearlyAnswers in taxCases
- [ ] Update `GET /cases/:id` to include yearlyAnswers
- [ ] Update `refreshChecklist` to use yearlyAnswers
- [ ] Write tests for new endpoint
- [ ] Test checklist generation with yearlyAnswers
- [ ] Test fallback logic (case with empty yearlyAnswers)

## Success Criteria

1. `POST /clients/:id/cases` creates new TaxCase with yearlyAnswers
2. Checklist generator uses yearlyAnswers when available
3. Fallback to intakeAnswers works for old cases
4. GET endpoints return yearlyAnswers field
5. No breaking changes to existing client creation flow
6. All existing tests pass

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Checklist mismatch | Medium | Medium | Extensive testing, fallback logic |
| Duplicate case creation | Low | Medium | Database unique constraint enforced |
| Type errors | Low | Low | Zod validation on all inputs |
| Performance | Low | Low | No new DB queries, same indexes |

## Security Considerations

- yearlyAnswers validated via Zod schema
- No raw SQL, Prisma handles escaping
- Same auth middleware applies to new endpoint
- PII in yearlyAnswers same protection as intakeAnswers

## Next Steps

After completion, proceed to [Phase 04: Frontend Changes](./phase-04-frontend-changes.md)

---

## Unresolved Questions

1. Should `POST /clients/:id/cases` send welcome SMS? (Probably no - returning client already has portal access)
2. Pre-fill yearlyAnswers from previous year? (Phase 05 feature)
