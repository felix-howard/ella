# Phase 1: Schema & Data Foundation

**Status:** Completed
**Last Updated:** 2026-01-19

## Overview

Phase 1 establishes the core database schema and type system for dynamic intake questionnaire handling, enabling flexible client profile data storage without schema migrations.

## Database Schema Changes

### ClientProfile Model Enhancement

Added flexible JSON field to `ClientProfile` for storing dynamic intake answers:

```prisma
model ClientProfile {
  id        String  @id @default(cuid())
  clientId  String  @unique
  client    Client  @relation(fields: [clientId], references: [id], onDelete: Cascade)

  // ... existing fields (filingStatus, hasW2, etc.)

  // Dynamic intake answers - flexible JSON storage for intake questionnaire responses
  // Maps questionKey -> value (boolean, number, string) from IntakeQuestion model
  intakeAnswers    Json    @default("{}")

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

**Rationale:**
- Supports 100+ dynamic intake questions without schema changes
- Stores answers keyed by `IntakeQuestion.questionKey`
- Default empty object prevents null references
- Migrations not required when adding new questions

## Type System

### IntakeAnswers Interface

Location: `packages/shared/src/types/intake-answers.ts`

Comprehensive TypeScript interface mapping all tax intake questionnaire fields:

```typescript
export interface IntakeAnswers {
  // Client Status / Identity
  isNewClient?: boolean
  hasIrsNotice?: boolean
  hasIdentityTheft?: boolean

  // Life Changes
  hasAddressChange?: boolean
  hasMaritalChange?: boolean
  hasNewChild?: boolean
  // ... ~100 more fields

  // Dynamic extensibility
  [key: string]: boolean | number | string | undefined
}
```

**Field Categories:**

| Category | Fields | Examples |
|----------|--------|----------|
| Client Status | 3 | `isNewClient`, `hasIrsNotice`, `hasIdentityTheft` |
| Life Changes | 5 | `hasAddressChange`, `hasMaritalChange`, `hasNewChild` |
| Employment Income | 3 | `hasW2`, `hasW2G`, `hasTipsIncome` |
| Self Employment | 1 | `hasSelfEmployment` |
| Banking & Investments | 3 | `hasBankAccount`, `hasInvestments`, `hasCrypto` |
| Retirement & Benefits | 4 | `hasRetirement`, `hasSocialSecurity`, `hasUnemployment`, `hasAlimony` |
| Rental & K-1 | 2 | `hasRentalProperty`, `hasK1Income` |
| Dependents | 5 | `hasKidsUnder17`, `numKidsUnder17`, `paysDaycare`, etc. |
| Health Insurance | 2 | `hasMarketplaceCoverage`, `hasHSA` |
| Deductions | 6 | `hasMortgage`, `hasPropertyTax`, `hasCharitableDonations`, etc. |
| Credits | 3 | `hasEnergyCredits`, `hasEVCredit`, `hasAdoptionExpenses` |
| Foreign | 3 | `hasForeignAccounts`, `hasForeignIncome`, `hasForeignTaxPaid` |
| Business | 6 | `businessName`, `ein`, `hasEmployees`, `hasContractors`, `has1099K`, `hasHomeOffice` |
| Business Entity | 18 | `entityName`, `entityEIN`, `stateOfFormation`, `accountingMethod`, etc. |
| Tax Info | 3 | `taxYear`, `filingStatus`, `refundMethod` |

**Supported Value Types:**
- `boolean` - Yes/No questions (e.g., `hasW2: true`)
- `number` - Numeric answers (e.g., `numKidsUnder17: 2`, `taxYear: 2025`)
- `string` - Text/select answers (e.g., `businessName: "ABC Corp"`, `filingStatus: "MARRIED_FILING_JOINTLY"`)
- `undefined` - Unanswered questions

## Validation & Security

### Zod Schema Validation

Location: `packages/shared/src/schemas/index.ts`

```typescript
export const intakeAnswersSchema = z
  .record(z.union([z.boolean(), z.number(), z.string()]))
  .refine(
    (data) => JSON.stringify(data).length <= MAX_INTAKE_ANSWERS_SIZE,
    { message: `Intake answers exceeds maximum size of ${MAX_INTAKE_ANSWERS_SIZE / 1024}KB` }
  )
```

**Validation Rules:**
1. Record of key-value pairs (schema matches IntakeAnswers interface)
2. Values: `boolean | number | string` only
3. **Size Limit:** Maximum 50KB (prevents DoS attacks)

**Constants:**
```typescript
const MAX_INTAKE_ANSWERS_SIZE = 50 * 1024 // 50KB
```

### Helper Functions

Location: `packages/shared/src/types/intake-answers.ts`

#### Type Guard
```typescript
export function isIntakeAnswers(value: unknown): value is IntakeAnswers
```
Validates structure before type casting.

#### Parse Function
```typescript
export function parseIntakeAnswers(json: unknown): IntakeAnswers
```
Safely parses JSON from database, returns empty object on failure.

#### Validate Function (API Input)
```typescript
export function validateIntakeAnswers(json: unknown):
  { success: true; data: IntakeAnswers } |
  { success: false; error: string }
```
**Use for API input validation:** Runs Zod schema check + size limit.

**Example:**
```typescript
const result = validateIntakeAnswers(req.body.intakeAnswers)
if (!result.success) {
  return res.json({ error: result.error }, { status: 400 })
}
const answers = result.data  // Type-safe IntakeAnswers
```

## Security Considerations

### Input Validation
- Always use `validateIntakeAnswers()` for API input
- Size limit prevents JSON-based DoS
- Zod enforces type constraints

### Storage
- React JSX auto-escapes JSON values
- If rendering via `dangerouslySetInnerHTML`, sanitize first
- String values may contain user input—sanitize in non-React contexts

### Type Safety
- Interface covers 100+ known fields
- Dynamic key support via index signature
- Helper functions ensure runtime validation

## Integration Points

### Frontend (Intake Form)
```typescript
// Store answers dynamically
const answers: IntakeAnswers = {
  hasW2: true,
  numKidsUnder17: 2,
  filingStatus: 'MARRIED_FILING_JOINTLY',
}
```

### API Endpoint
```typescript
// Validate & store in ClientProfile
const result = validateIntakeAnswers(req.body.intakeAnswers)
if (!result.success) return error(400, result.error)

await prisma.clientProfile.upsert({
  where: { clientId },
  create: { clientId, intakeAnswers: result.data },
  update: { intakeAnswers: result.data },
})
```

### Database Query
```typescript
// Retrieve & parse answers
const profile = await prisma.clientProfile.findUnique({
  where: { clientId },
})
const answers = parseIntakeAnswers(profile?.intakeAnswers)
```

## Backward Compatibility

- Default `intakeAnswers: {}` prevents null issues
- Existing ClientProfiles unaffected until first update
- No migration required to existing records
- Adding new question keys automatic (no schema change)

## Future Extensibility

### Adding New Questions
1. Update `IntakeQuestion` model in database
2. Add property to `IntakeAnswers` interface (optional)
3. No schema migration needed
4. Zod validation remains compatible

### Conditional Display
Use `IntakeQuestion.condition` JSON field to show questions based on profile:
```typescript
// Example: IntakeQuestion.condition
{ "hasSelfEmployment": true }
// Shows question only if hasSelfEmployment === true
```

---

**Related Documentation:**
- Database Schema: `packages/db/prisma/schema.prisma`
- Type Definitions: `packages/shared/src/types/intake-answers.ts`
- Schemas: `packages/shared/src/schemas/index.ts`
- Code Standards: `docs/code-standards.md` (Shared Types & Validation section)
