# Research Report: Multi-Year Tax Case Data Model Migration
**Date:** 2026-01-23
**Branch:** feature/multi-year-tax-case
**Timezone:** Asia/Bangkok

---

## Executive Summary
Current schema tightly couples Client creation with single-year TaxCase via ClientProfile.intakeAnswers. Implement Option 3+4 hybrid: move year-specific answers to TaxCase.yearlyAnswers (JSON field), keep static profile data in ClientProfile. Zero downtime migration strategy using backward-compatible approach.

---

## Current Data Model Analysis

### Existing Schema Structure
```
Client
├── id, name, phone (UNIQUE), email, language
└── ClientProfile (1:1)
    ├── Static: filingStatus (misleading - should be in TaxCase)
    ├── Business fields: ein, hasEmployees, hasContractors
    └── intakeAnswers (JSON) ← CONTAINS BOTH STATIC + YEARLY DATA
        └── Mixes: SSN, DOB, hasW2, has1099NEC, income sources, deductions

TaxCase
├── id, clientId, taxYear (UNIQUE with clientId), taxTypes[], status
├── Constraint: @@unique([clientId, taxYear])
└── Workflow: INTAKE → WAITING_DOCS → IN_PROGRESS → FILED
```

### Current Problems
1. **intakeAnswers location:** ClientProfile stores it, but semantically belongs to TaxCase
2. **Phone uniqueness:** Forces one Client per person; multi-year cases need separate clients (breaks identity)
3. **Data duplication:** Returning clients can't add 2026 case without creating new Client record
4. **Questionnaire coupling:** Static fields (SSN, DOB) re-asked annually

### Existing Indexes
- `TaxCase: @@unique([clientId, taxYear])`
- `TaxCase: @@index([status, taxYear])`
- `TaxCase: @@index([clientId, status])`

---

## Proposed Schema Changes

### Migration: Add yearlyAnswers to TaxCase

**New field in TaxCase model:**
```prisma
yearlyAnswers  Json  @default("{}")  // Year-specific intake questionnaire
```

**Revised field classification:**

| Field | Current Location | New Location | Migration |
|-------|------------------|--------------|-----------|
| SSN, DOB, DL, Address, Bank | ClientProfile.intakeAnswers | ClientProfile.intakeAnswers | Keep (static) |
| hasW2, has1099NEC, income sources | ClientProfile.intakeAnswers | TaxCase.yearlyAnswers | Migrate per year |
| Filing Status | ClientProfile.filingStatus | TaxCase.yearlyAnswers | Migrate |
| Dependents, Deductions | ClientProfile.intakeAnswers | TaxCase.yearlyAnswers | Migrate per year |

---

## Migration Strategy (5-Phase, Zero Downtime)

### Phase 1: Schema Migration
**SQL:**
```sql
ALTER TABLE "TaxCase"
ADD COLUMN "yearlyAnswers" jsonb DEFAULT '{}';
```

**Prisma:**
- Add field to schema.prisma
- Run `pnpm -F @ella/db prisma migrate dev --name add_yearly_answers_to_tax_case`

### Phase 2: Data Migration (Backward Compatible)
**For each existing TaxCase:**
```sql
UPDATE "TaxCase" tc
SET "yearlyAnswers" = (
  SELECT jsonb_object_agg(key, value)
  FROM jsonb_each(cp."intakeAnswers")
  WHERE key IN ('hasW2', 'has1099NEC', 'hasSelfEmployment', 'filingStatus',
                'hasRentalProperty', 'hasInvestments', 'hasCrypto',
                'numKidsUnder17', 'paysDaycare', 'hasKids17to24')
)
FROM "ClientProfile" cp
WHERE tc."clientId" = cp."clientId";
```

**Keep intakeAnswers in ClientProfile** (no deletion yet - backward compat)

### Phase 3: Code Migration
1. Update API endpoints to read yearly answers from TaxCase.yearlyAnswers
2. Update checklist generator to read from TaxCase.yearlyAnswers
3. Add fallback logic to read from ClientProfile.intakeAnswers if yearlyAnswers empty
4. Update questionnaire UI to reference correct location

### Phase 4: Cleanup (After 2-week validation period)
- Deprecate intakeAnswers from ClientProfile in API responses
- Add migration to remove yearly fields from ClientProfile.intakeAnswers
- Update documentation

### Phase 5: New Features
- Implement "Add Tax Case for [Year]" flow
- Pre-fill yearlyAnswers from previous year
- Support tax organizer self-serve link

---

## SQL Migration Script (Executable)

```sql
-- Step 1: Add column (idempotent)
ALTER TABLE "TaxCase"
ADD COLUMN IF NOT EXISTS "yearlyAnswers" jsonb DEFAULT '{}';

-- Step 2: Verify no data loss (check row count)
SELECT COUNT(*) as existing_cases FROM "TaxCase";

-- Step 3: Migrate yearly data from ClientProfile to TaxCase
UPDATE "TaxCase" tc
SET "yearlyAnswers" = COALESCE(
  (
    SELECT jsonb_object_agg(key, value)
    FROM jsonb_each(cp."intakeAnswers")
    WHERE key IN (
      'hasW2', 'has1099NEC', 'hasSelfEmployment', 'filingStatus',
      'hasRentalProperty', 'hasInvestments', 'hasCrypto', 'numKidsUnder17',
      'paysDaycare', 'hasKids17to24', 'hasKidsUnder17', 'hasSelfEmployment',
      'hasBankAccount', 'hasInvestments', 'hasKidsUnder17'
    )
  ),
  '{}'::jsonb
)
FROM "ClientProfile" cp
WHERE tc."clientId" = cp."clientId"
AND tc."yearlyAnswers" = '{}';

-- Step 4: Verify migration (should show 0 after successful migration)
SELECT COUNT(*)
FROM "TaxCase"
WHERE "yearlyAnswers" = '{}';

-- Rollback (if needed)
-- ALTER TABLE "TaxCase" DROP COLUMN "yearlyAnswers";
-- UPDATE "ClientProfile" SET "intakeAnswers" = ...; (restore backup)
```

---

## Rollback Strategy

**If migration fails:**
```sql
ALTER TABLE "TaxCase" DROP COLUMN "yearlyAnswers";
```

**Data safety:** Keep ClientProfile.intakeAnswers unchanged for recovery.

**Application rollback:** Revert code changes to read from ClientProfile.intakeAnswers only.

---

## Backward Compatibility

**During transition period (2-4 weeks):**

```typescript
// Fallback pattern in API
function getYearlyAnswers(taxCase: TaxCase, profile: ClientProfile) {
  // Try TaxCase.yearlyAnswers first (new location)
  if (taxCase.yearlyAnswers && Object.keys(taxCase.yearlyAnswers).length > 0) {
    return taxCase.yearlyAnswers;
  }

  // Fallback to ClientProfile.intakeAnswers (old location)
  return extractYearlyFields(profile.intakeAnswers);
}
```

**Benefits:**
- Old API clients still work
- New clients use TaxCase.yearlyAnswers
- Gradual migration with validation

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Data loss during migration | Low | High | Backup DB before migration, verify row counts |
| Incomplete yearly answer migration | Medium | Medium | Fallback logic, data validation queries |
| Query performance | Low | Medium | Existing indexes on TaxCase still valid |
| Concurrent requests during migration | Low | High | Run migration during maintenance window, use transactions |

---

## Validation Queries (Post-Migration)

```sql
-- Verify all cases have yearly answers populated
SELECT tc.id, tc."taxYear", tc."yearlyAnswers"
FROM "TaxCase" tc
WHERE tc."yearlyAnswers" = '{}'
AND tc."createdAt" < NOW() - INTERVAL '1 day';

-- Check data integrity
SELECT
  COUNT(*) as total_cases,
  COUNT(CASE WHEN tc."yearlyAnswers" != '{}' THEN 1 END) as migrated,
  COUNT(CASE WHEN tc."yearlyAnswers" = '{}' THEN 1 END) as pending
FROM "TaxCase" tc;
```

---

## Implementation Checklist

- [ ] Backup production database
- [ ] Add `yearlyAnswers` field to schema.prisma
- [ ] Create Prisma migration
- [ ] Execute migration on dev database
- [ ] Run validation queries
- [ ] Update API service to read from TaxCase.yearlyAnswers
- [ ] Add fallback logic for backward compatibility
- [ ] Update checklist generator service
- [ ] Test existing client workflows (should still work)
- [ ] Deploy to staging, validate for 1 week
- [ ] Deploy to production during low-traffic window
- [ ] Monitor error logs for 48 hours
- [ ] Remove fallback logic after 2-week validation
- [ ] Update documentation

---

## Next Steps (For Implementation Team)

1. **Immediate:** Merge schema change to branch, create migration
2. **Week 1:** Deploy migration to dev/staging, validate data
3. **Week 2:** Deploy to production with fallback logic active
4. **Week 3:** Monitor, collect metrics
5. **Week 4:** Remove fallback, finalize cleanup

---

## Unresolved Questions

1. **Business logic:** Should filingStatus be stored in TaxCase or passed from form each time?
2. **Dependent data:** Are dependents always the same per client or vary by tax year?
3. **Profile updates:** If SSN changes, how to reconcile with existing TaxCase records?
4. **Archival:** Should old yearly answers be archived or pruned after filing?
