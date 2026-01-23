# Phase 01: Database Schema Changes

## Context

- **Parent Plan**: [plan.md](./plan.md)
- **Dependencies**: None (first phase)
- **Related Docs**: [researcher-database-migration.md](./research/researcher-database-migration.md)

## Overview

| Field | Value |
|-------|-------|
| Date | 2026-01-23 |
| Description | Add yearlyAnswers JSON field to TaxCase model |
| Priority | High |
| Effort | 0.5d |
| Implementation Status | Not Started |
| Review Status | Pending |

## Key Insights

1. TaxCase already has unique constraint `@@unique([clientId, taxYear])` - perfect for multi-year
2. Adding JSON column with default `{}` is zero-downtime on PostgreSQL
3. No index needed on yearlyAnswers - existing TaxCase indexes sufficient

## Requirements

### Functional
- Add `yearlyAnswers Json @default("{}")` to TaxCase model
- Prisma migration must be idempotent (safe to rerun)
- Default value ensures backward compatibility

### Non-Functional
- Zero downtime deployment
- No data loss risk
- Migration < 1 minute for 10k records

## Architecture

```prisma
model TaxCase {
  id        String        @id @default(cuid())
  clientId  String
  client    Client        @relation(...)

  taxYear   Int
  taxTypes  TaxType[]
  status    TaxCaseStatus @default(INTAKE)

  yearlyAnswers  Json  @default("{}")  // NEW: year-specific intake data

  // ... existing fields
}
```

## Related Code Files

### Modify
- `packages/db/prisma/schema.prisma` - Add yearlyAnswers field

### Create
- `packages/db/prisma/migrations/YYYYMMDD_add_yearly_answers_to_tax_case/migration.sql`

## Implementation Steps

1. **Update schema.prisma**
   ```prisma
   // In TaxCase model, after taxTypes field:
   yearlyAnswers  Json  @default("{}")
   ```

2. **Generate migration**
   ```bash
   cd packages/db
   pnpm prisma migrate dev --name add_yearly_answers_to_tax_case
   ```

3. **Verify migration SQL**
   - Check generated SQL is: `ALTER TABLE "TaxCase" ADD COLUMN "yearlyAnswers" jsonb DEFAULT '{}'`
   - Confirm no DROP or destructive statements

4. **Regenerate Prisma client**
   ```bash
   pnpm prisma generate
   ```

5. **Test locally**
   - Create new TaxCase - verify yearlyAnswers defaults to `{}`
   - Update existing TaxCase - verify yearlyAnswers accessible
   - Query TaxCase - verify yearlyAnswers in response

## Todo List

- [ ] Add yearlyAnswers field to schema.prisma
- [ ] Generate Prisma migration
- [ ] Review generated SQL for safety
- [ ] Run migration on dev database
- [ ] Verify TaxCase queries include yearlyAnswers
- [ ] Update TypeScript types if needed
- [ ] Test create/read/update operations

## Success Criteria

1. Migration runs without errors on dev database
2. Existing TaxCase records have `yearlyAnswers = {}`
3. New TaxCase records can store/retrieve yearlyAnswers
4. No breaking changes to existing API endpoints
5. Prisma client types include yearlyAnswers field

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration fails | Low | Low | Rollback: `ALTER TABLE "TaxCase" DROP COLUMN "yearlyAnswers"` |
| Type mismatch | Low | Low | Prisma handles JSON typing automatically |
| Performance regression | Low | Low | No new indexes, existing queries unaffected |

## Security Considerations

- yearlyAnswers may contain PII (SSN, income) - same protection as intakeAnswers
- No additional encryption needed (database-level encryption applies)
- API access control unchanged

## Next Steps

After completion, proceed to [Phase 02: Data Migration](./phase-02-data-migration.md)
