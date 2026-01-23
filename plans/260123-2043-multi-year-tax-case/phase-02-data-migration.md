# Phase 02: Data Migration

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Dependencies**: [Phase 01](./phase-01-database-schema.md) completed
- **Related Docs**: [researcher-database-migration.md](./research/researcher-database-migration.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-23 |
| Description | Migrate yearly fields from ClientProfile.intakeAnswers to TaxCase.yearlyAnswers |
| Priority | High |
| Effort | 1d |
| Implementation Status | Not Started |
| Review Status | Pending |

## Key Insights

1. intakeAnswers contains both static (SSN, DOB) and yearly (hasW2, filingStatus) data
2. Must preserve original intakeAnswers for backward compatibility during transition
3. Each TaxCase maps to one Client's intakeAnswers (1:1 relationship via clientId)

## Requirements

### Functional
- Copy yearly fields from ClientProfile.intakeAnswers to TaxCase.yearlyAnswers
- Preserve static fields in ClientProfile.intakeAnswers
- Handle cases with empty intakeAnswers gracefully

### Non-Functional
- Transaction-safe migration (all or nothing)
- Validation queries to verify data integrity
- Runnable during low-traffic window (if any production data)

## Architecture

### Yearly Fields (Move to TaxCase)
```json
{
  "hasW2": true,
  "w2Count": 2,
  "has1099NEC": false,
  "hasSelfEmployment": true,
  "hasRentalProperty": false,
  "hasInvestments": true,
  "hasCrypto": false,
  "filingStatus": "MFJ",
  "numKidsUnder17": 2,
  "paysDaycare": true,
  "hasKids17to24": false,
  "dependents": [...]
}
```

### Static Fields (Keep in ClientProfile)
```json
{
  "ssn": "xxx-xx-xxxx",
  "spouseSsn": "xxx-xx-xxxx",
  "dob": "1985-01-15",
  "spouseDob": "1987-03-22",
  "dlNumber": "D1234567",
  "dlState": "CA",
  "dlExpiry": "2028-01-15",
  "address": "123 Main St",
  "city": "San Jose",
  "state": "CA",
  "zip": "95123",
  "bankAccount": "1234567890",
  "routingNumber": "121000248"
}
```

## Related Code Files

### Create
- `packages/db/prisma/migrations/YYYYMMDD_migrate_yearly_answers/migration.sql` (manual SQL)
- `apps/api/src/scripts/migrate-yearly-answers.ts` (TypeScript migration script)

### Modify
- None (data-only migration)

## Implementation Steps

1. **Create migration script**

   File: `apps/api/src/scripts/migrate-yearly-answers.ts`
   ```typescript
   const YEARLY_KEYS = [
     'hasW2', 'w2Count', 'has1099NEC', 'num1099NECReceived',
     'hasSelfEmployment', 'hasRentalProperty', 'rentalPropertyCount',
     'hasInvestments', 'hasCrypto', 'filingStatus',
     'numKidsUnder17', 'paysDaycare', 'hasKids17to24',
     'hasKids17to24InSchool', 'dependents', 'hasRetirement',
     'hasSocialSecurity', 'hasK1', 'k1Count', 'hasForeignAccounts',
     'hasMortgage', 'hasMedicalExpenses', 'hasCharitableContributions',
     'hasStudentLoanInterest', 'hasEducatorExpenses', 'hasPropertyTax'
   ]

   // For each TaxCase, extract yearly keys from client's intakeAnswers
   ```

2. **Backup database before migration**
   ```bash
   pg_dump $DATABASE_URL > backup_before_yearly_migration.sql
   ```

3. **Run migration in transaction**
   ```typescript
   await prisma.$transaction(async (tx) => {
     const cases = await tx.taxCase.findMany({
       where: { yearlyAnswers: { equals: {} } },
       include: { client: { include: { profile: true } } }
     })

     for (const taxCase of cases) {
       const intakeAnswers = taxCase.client.profile?.intakeAnswers || {}
       const yearlyAnswers = extractYearlyFields(intakeAnswers, YEARLY_KEYS)

       await tx.taxCase.update({
         where: { id: taxCase.id },
         data: { yearlyAnswers }
       })
     }
   })
   ```

4. **Run validation queries**
   ```sql
   -- Count cases with populated yearlyAnswers
   SELECT COUNT(*) as migrated
   FROM "TaxCase"
   WHERE "yearlyAnswers" != '{}';

   -- Verify no data loss (compare key counts)
   SELECT tc.id, tc."taxYear",
     jsonb_object_keys(tc."yearlyAnswers") as yearly_keys
   FROM "TaxCase" tc
   LIMIT 10;
   ```

5. **Add fallback helper function**

   File: `apps/api/src/lib/yearly-answers.ts`
   ```typescript
   export function getYearlyAnswers(
     taxCase: TaxCase,
     profile: ClientProfile
   ): Record<string, unknown> {
     // New location (preferred)
     if (taxCase.yearlyAnswers && Object.keys(taxCase.yearlyAnswers).length > 0) {
       return taxCase.yearlyAnswers as Record<string, unknown>
     }
     // Fallback to old location
     return extractYearlyFields(profile.intakeAnswers)
   }
   ```

## Todo List

- [ ] Create YEARLY_KEYS constant with all yearly field names
- [ ] Write migration script with transaction wrapper
- [ ] Backup dev database
- [ ] Run migration on dev database
- [ ] Verify row counts match (before/after)
- [ ] Spot-check 5-10 records for data accuracy
- [ ] Create fallback helper function
- [ ] Test API endpoints still work
- [ ] Document rollback procedure

## Success Criteria

1. All TaxCase records have yearlyAnswers populated (where client had intakeAnswers)
2. Yearly fields correctly extracted (hasW2, filingStatus, etc.)
3. Static fields remain in ClientProfile.intakeAnswers
4. No API errors during/after migration
5. Checklist generator still works (will test in Phase 03)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Partial migration | Low | High | Transaction rollback on error |
| Wrong field classification | Medium | Medium | Review YEARLY_KEYS list with business |
| Performance on large dataset | Low | Low | Batch processing with chunked updates |
| Missing intakeAnswers | Low | Low | Default to `{}` for yearlyAnswers |

## Security Considerations

- Migration script runs with database admin privileges
- No sensitive data exposed in logs (redact SSN, bank info)
- Backup file should be stored securely, deleted after validation

## Rollback Procedure

```sql
-- If migration fails, yearlyAnswers can be reset
UPDATE "TaxCase" SET "yearlyAnswers" = '{}';
-- Original intakeAnswers untouched - no data loss
```

## Validation Queries

```sql
-- 1. Total TaxCase count
SELECT COUNT(*) FROM "TaxCase";

-- 2. Cases with non-empty yearlyAnswers
SELECT COUNT(*) FROM "TaxCase" WHERE "yearlyAnswers" != '{}';

-- 3. Cases with empty yearlyAnswers (should be 0 after migration)
SELECT COUNT(*) FROM "TaxCase" WHERE "yearlyAnswers" = '{}';

-- 4. Sample data verification
SELECT tc.id, tc."taxYear", tc."yearlyAnswers"
FROM "TaxCase" tc
ORDER BY tc."createdAt" DESC
LIMIT 5;
```

## Next Steps

After completion, proceed to [Phase 03: API Updates](./phase-03-api-updates.md)

---

## Unresolved Questions

1. Should `dependents` array be classified as yearly or static? (Currently: yearly - kids age out)
2. If client has multiple TaxCases, should all share same yearlyAnswers initially? (Answer: No, each gets copy from migration)
